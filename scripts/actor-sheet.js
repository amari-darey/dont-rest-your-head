export default class DryhActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dryh", "sheet", "actor", "dryh-sheet"],
      template: "systems/dryh/templates/actor-sheet.html",
      width: 800,
      height: 850,
      resizable: true,
      minimizable: true,
      tabs: [{ nav: ".sheet-tabs", content: ".sheet-body", initial: "main" }]
    });
  }

  getData() {
    const data = super.getData();
    const system = data.actor.system ?? data.actor.data?.data ?? {};

    system.attributes = system.attributes ?? { discipline: 3, madness: 0, exhaustion: 0 };
    system.reactions = system.reactions ?? { hit: 0, flee: 0 };
    system.info = system.info ?? {
      role: "",
      whatKeepsMeUp: "",
      whatJustHappened: "",
      appearance: "",
      whoIReallyAm: "",
      path: ""
    };
    system.skills = system.skills ?? { madness: "", exhaustion: "" };
    system.awakened = system.awakened ?? false;

    if (data.actor.system) data.actor.system = system;
    else data.actor.data.data = system;

    const makeBoxes = (value, max) => Array.from({ length: max }, (_, i) => i < (Number(value) || 0));

    data.disciplineBoxes = makeBoxes(system.attributes.discipline, 3);
    data.madnessBoxes = makeBoxes(system.attributes.madness, 3);
    data.exhaustionBoxes = makeBoxes(system.attributes.exhaustion, 6);
    data.hitBoxes = makeBoxes(system.reactions.hit, 3);
    data.fleeBoxes = makeBoxes(system.reactions.flee, 3);

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on("click", "[data-action='roll-dice']", () => this._rollDice());
    html.on("click", ".dryh-awake-status-on", () => this._startAwakening());
    
    html.on("click", ".avatar", this._onEditImage.bind(this));

    html.on('change', '.dryh-scar-content textarea', async (event) => {
        const textarea = event.target;
        const scarItem = $(textarea).closest('.dryh-scar-item');
        const index = parseInt(scarItem.data('index'));
        const newText = textarea.value;
        
        const newScars = [...(this.actor.system.scars || [])];
        if (newScars[index] !== undefined) {
            newScars[index] = newText;
            await this.actor.update({ "system.scars": newScars });
        }
    });

    document.querySelector('.dryh-sheet').addEventListener('click', async (event) => {
      if (event.target.closest('[data-action="add-scar"]')) {
          const newScars = [...this.actor.system.scars, ""];
          await this.actor.update({ "system.scars": newScars });
      }
      
      if (event.target.closest('[data-action="remove-scar"]')) {
          const button = event.target.closest('[data-action="remove-scar"]');
          const index = parseInt(button.dataset.index);
          const newScars = [...this.actor.system.scars];
          newScars.splice(index, 1);
          await this.actor.update({ "system.scars": newScars });
      }
    });
    html.find('.dryh-tabs .item').click(this._onTabClick.bind(this));
    html.on("dblclick", ".dryh-inventory-item", this._onItemDoubleClick.bind(this));
    this._setupDragAndDrop(html);
  }

  _setupDragAndDrop(html) {
    html.on("drop", "form", () => this._onDrop.bind(this));
    html.on("dragover", "form", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

  html.find('.dryh-item-delete').click(this._onItemDelete.bind(this));

  }

  async _onDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    let data;
    try {
        data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (err) {
        return;
    }
    
    if (data.type === 'Item') {
        try {
            const item = await fromUuid(data.uuid);
            if (!item) return;
            const itemData = item.toObject();
            delete itemData._id;
            
            await this.actor.createEmbeddedDocuments("Item", [itemData]);
        } catch (error) {
            console.error("Ошибка при добавлении предмета:", error);
        }
    }
  }

  async _onItemDoubleClick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (event.target.closest && event.target.closest('.dryh-item-delete')) return;

    const el = event.currentTarget || event.target.closest('.dryh-inventory-item');
    const itemIdRaw = el?.dataset?.itemId || $(el).data('item-id');
    if (!itemIdRaw) return ui.notifications.warn("Не удалось определить ID предмета.");

    let item = this.actor.items.get(itemIdRaw)
            || this.actor.items.get(itemIdRaw.replace(/^_/, ''))
            || this.actor.items.find(i => (i._id === itemIdRaw || i.id === itemIdRaw));

    if (!item) {
      return ui.notifications.warn("Предмет не найден в инвентаре персонажа.");
    }

    try {
      item.sheet.render(true);
    } catch (err) {
      console.error("Ошибка при открытии листа предмета:", err);
      ui.notifications.error("Не удалось открыть лист предмета. Смотрите консоль.");
    }
  }

  _onTabClick(event) {
    event.preventDefault();
    const tabName = event.currentTarget.dataset.tab;
    
    this.element.find('.dryh-tabs .item').removeClass('active');
    event.currentTarget.classList.add('active');
    
    this.element.find('.tab').removeClass('active');
    this.element.find(`.tab[data-tab="${tabName}"]`).addClass('active');
  }

  async _onItemDelete(event) {
    event.preventDefault();
    event.stopPropagation();

    const itemId = $(event.currentTarget).data("itemId");
    if (!itemId) return;

    const confirmDelete = await Dialog.confirm({
      title: "Удалить предмет?",
      content: "<p>Вы уверены, что хотите удалить этот предмет из инвентаря?</p>"
    });

    if (!confirmDelete) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);

    this.render(true);
  }

  async _onEditImage(event) {
    event.preventDefault();
    const fp = new FilePicker({
      type: "image",
      current: this.actor.img,
      callback: async (path) => {
        await this.actor.update({ img: path });
        await this._syncTokensWithActorImage();
      }
    });
    return fp.browse();
  }

  async _syncTokensWithActorImage() {
    const tokens = this.actor.getActiveTokens();
    for (const token of tokens) {
      await token.document.update({ img: this.actor.img });
    }
  }

  async _rollDice() {
    const form = this.element.find("form")[0];
    const madnessDice = parseInt(form.querySelector("#madness-dice").value, 10) || 0;
    const exhaustionDice = parseInt(form.querySelector("#exhaustion-dice").value, 10) || 0;

    const { discipline, madness, exhaustion } = this.actor.system.attributes;
    const totalDice = discipline + madness + exhaustion + madnessDice + exhaustionDice;

    if (totalDice <= 0) {
      ui.notifications.warn("Нет кубиков для броска");
      return;
    }

    const formula = `${totalDice}d6`;
    const roll = new Roll(formula);
    await roll.evaluate({ async: true });

    const results = roll.dice[0].results;
    let index = 0;

    const sliceGroup = (count) => {
      const group = results.slice(index, index + count);
      index += count;
      return group;
    };

    const disciplineResults = sliceGroup(discipline);
    const madnessResults = sliceGroup(madness + madnessDice);
    const exhaustionResults = sliceGroup(exhaustion + exhaustionDice);

    const makeDieHtml = (result, style) => `
      <div style="${style}">
        ${result.result}
      </div>
    `;

    const baseStyles = {
      discipline: "width:40px;height:40px;border-radius:8px;background:rgba(200,200,200,0.8);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;box-shadow:0 4px 8px rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);",
      madness: "width:40px;height:40px;border-radius:8px;background:rgba(220,50,50,0.8);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;box-shadow:0 4px 8px rgba(0,0,0,0.3);border:1px solid rgba(255,0,0,0.3);",
      exhaustion: "width:40px;height:40px;border-radius:8px;background:rgba(30,30,30,0.9);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;color:#e0e0e0;box-shadow:0 4px 8px rgba(0,0,0,0.5);border:1px solid rgba(0,0,0,0.5);"
    };

    const diceHtml = [
      ...disciplineResults.map(r => makeDieHtml(r, baseStyles.discipline)),
      ...madnessResults.map(r => makeDieHtml(r, baseStyles.madness)),
      ...exhaustionResults.map(r => makeDieHtml(r, baseStyles.exhaustion))
    ].join("");

    const countSuccesses = (arr) => arr.filter(r => r.result <= 3).length;
    const totalSuccesses = countSuccesses(disciplineResults) + countSuccesses(madnessResults) + countSuccesses(exhaustionResults);

    const countValue = (arr, v) => arr.filter(r => r.result === v).length;

    const d6 = countValue(disciplineResults, 6);
    const m6 = countValue(madnessResults, 6);
    const e6 = countValue(exhaustionResults, 6);

    const d5 = countValue(disciplineResults, 5);
    const m5 = countValue(madnessResults, 5);
    const e5 = countValue(exhaustionResults, 5);

    const d4 = countValue(disciplineResults, 4);
    const m4 = countValue(madnessResults, 4);
    const e4 = countValue(exhaustionResults, 4);

    const compare = (a6, a5, a4, b6, b5, b4) =>
      a6 > b6 || (a6 === b6 && a5 > b5) || (a6 === b6 && a5 === b5 && a4 > b4);

    let dominantPool = "Дисциплина";
    if (compare(m6, m5, m4, d6, d5, d4)) dominantPool = "Безумие";
    else if (compare(e6, e5, e4, d6, d5, d4)) dominantPool = "Истощение";
    else if (compare(e6, e5, e4, m6, m5, m4)) {
      if (compare(e6, e5, e4, d6, d5, d4)) dominantPool = "Истощение";
    } else if (m6 === d6 && m5 === d5 && m4 === d4 && e6 === d6 && e5 === d5 && e4 === d4) {
      dominantPool = "Дисциплина";
    }

    if (game.dice3d) {
        await game.dice3d.showForRoll(roll, game.user, !roll.isPrivate, null, false);
    }

    const messageContent = `
      <div style="background:linear-gradient(135deg,#1a1a1a 0%,#0d0d0d 100%);padding:15px;border-radius:10px;color:#e0e0e0;font-family:Inter,sans-serif;">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <strong style="color:#ff4757;font-size:18px;">Бросок ${this.actor.name}</strong>
          <span style="color:#4da6ff;font-family:monospace;">${formula}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin:15px 0;">
          ${diceHtml}
        </div>
        <div style="text-align:center;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.05);">
          <strong style="color:#ff4757;font-size:20px;">${totalSuccesses} успех${totalSuccesses === 1 ? '' : totalSuccesses < 5 ? 'а' : 'ов'}</strong>
          <div style="margin-top:8px;color:#4da6ff;font-size:14px;">Доминирует: ${dominantPool}</div>
        </div>
        <div style="display:flex;justify-content:space-around;margin-top:10px;font-size:13px;color:#9e9e9e;">
          <span>Дисциплина: ${discipline}</span>
          <span>Безумие: ${madness + madnessDice}</span>
          <span>Истощение: ${exhaustion + exhaustionDice}</span>
        </div>
      </div>
    `;

    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: messageContent,
      whisper: roll.isPrivate,
      sound: CONFIG.sounds.dice
    });

    const updates = {};
    if (madnessDice > 0) updates["system.attributes.madness"] = Math.min(3, (this.actor.system.attributes.madness ?? 0) + 1);
    if (exhaustionDice > 0) updates["system.attributes.exhaustion"] = Math.min(6, (this.actor.system.attributes.exhaustion ?? 0) + 1);

    if (Object.keys(updates).length > 0) {
      await this.actor.update(updates);
      this.render();
    }
  }

  async _startAwakening() {
    const actor = this.actor;
    const steps = [
      { field: "name", title: "Твоё имя", hint: "Твоё имя", defaultValue: actor.name },
      { field: "role", title: "Кто я", hint: "Кто ты (Профессия)", defaultValue: actor.system.info.role },
      { field: "whatKeepsMeUp", title: "Что не дает мне уснуть?", hint: "Это источник бессонницы персонажа и показывает, какой была непосредственная история персонажа.", defaultValue: actor.system.info.whatKeepsMeUp },
      { field: "whatJustHappened", title: "Что случилось только что?", hint: "Это то, что происходит с персонажем в его самой первой сцене игры", defaultValue: actor.system.info.whatJustHappened },
      { field: "appearance", title: "Какой я снаружи?", hint: "Это определяет первое впечатление, которое производит персонаж, и говорит о том, что очевидно о нем. Подумайте о том, каким кажется главный герой на первый взгляд", defaultValue: actor.system.info.appearance },
      { field: "whoIReallyAm", title: "Кто я на самом деле?", hint: "Это говорит о секретах главного героя, о той части его самого, которую он не показывает миру, если может этого избежать. Подумайте о том, каковы секреты главного героя?", defaultValue: actor.system.info.whoIReallyAm },
      { field: "path", title: "Каков мой путь?", hint: "Этот вопрос касается целей персонажа и указывает на то, как в вакууме история о нем могла бы прийти к своему завершению.", defaultValue: actor.system.info.path },
      { field: "madnessSkill", title: "Навык Безумия", hint: "Это некие сверхспособности персонажа.\nПример:\nНевидимость, чтение мыслей, невидимые помощники, прочие мистические навыки", defaultValue: actor.system.skills.madness },
      { field: "exhaustionSkill", title: "Навык Истощения", hint: "Это некий талант персонажа, который сверхъестественно лучше, чем у других людей.\nПример:\nБег, стрельба, игра на музыкальном инструменте прочие физические навыки", defaultValue: actor.system.skills.exhaustion },
      { field: "reactions", title: "Реакции", hint: "Распределите 3 очка между реакцией 'Бей' и 'Беги'. Вы будете использовать оставшиеся реакции в случае доминирования безумия", points: 3 }
    ];

    const answers = {
      name: actor.name,
      role: actor.system.info.role,
      whatKeepsMeUp: actor.system.info.whatKeepsMeUp,
      whatJustHappened: actor.system.info.whatJustHappened,
      appearance: actor.system.info.appearance,
      whoIReallyAm: actor.system.info.whoIReallyAm,
      path: actor.system.info.path,
      madnessSkill: actor.system.skills.madness,
      exhaustionSkill: actor.system.skills.exhaustion,
      reactions: { hit: 0, flee: 0 }
    };

    let stepIndex = 0;

    while (stepIndex < steps.length) {
      const step = steps[stepIndex];
      try {
        if (step.field === "reactions") {
          answers.reactions = await this._askReactionsCheckboxes(step.points, step.hint, stepIndex > 0);
        } else {
          answers[step.field] = await this._ask(step.title, step.defaultValue, step.hint, stepIndex > 0);
        }
        stepIndex++;
      } catch (err) {
        if (err === "back" && stepIndex > 0) {
          stepIndex--;
          continue;
        } else if (err === "cancelled" || err === "closed") {
          ui.notifications.warn("Создание персонажа отменено");
          
          const awakeStatus = this.element.find('.dryh-awake-status');
          if (awakeStatus.length) {
            awakeStatus.removeClass('awakened');
          }
          
          return;
        }
        throw err;
      }
    }

    await actor.update({
      name: answers.name,
      "system.info.role": answers.role,
      "system.info.whatKeepsMeUp": answers.whatKeepsMeUp,
      "system.info.whatJustHappened": answers.whatJustHappened,
      "system.info.appearance": answers.appearance,
      "system.info.whoIReallyAm": answers.whoIReallyAm,
      "system.info.path": answers.path,
      "system.skills.madness": answers.madnessSkill,
      "system.skills.exhaustion": answers.exhaustionSkill,
      "system.reactions.hit": answers.reactions.hit,
      "system.reactions.flee": answers.reactions.flee,
      "system.attributes.discipline": 3,
      "system.attributes.exhaustion": 0,
      "system.attributes.madness": 0,
      "system.awakened": true
    });

    const awakeStatus = this.element.find('.dryh-awake-status');
    if (awakeStatus.length) {
      awakeStatus.addClass('awakened');
      awakeStatus.prop('title', 'Персонаж пробужден');
      awakeStatus.css('cursor', 'default');
    }

    const awakeButtonSlot = this.element.find('.awake-button-slot');
    if (awakeButtonSlot.length) {
      awakeButtonSlot.empty();
    }

    this.render();
    ui.notifications.info("Персонаж пробужден.");
  }

  _ask(title, def = "", hint = "", showBackButton = false) {
    return new Promise((resolve, reject) => {
      const content = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #e0e0e0; background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); padding: 20px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);">
          <div style="margin-bottom: 15px; padding: 12px; background: rgba(30, 30, 30, 0.7); border-left: 3px solid #ff4757; border-radius: 0 8px 8px 0; font-style: italic; color: #a0a0a0; font-size: 14px; line-height: 1.5;">
            ${hint}
          </div>
          <textarea id="dryh-input" style="width:100%;min-height:100px;padding:16px;border-radius:10px;border:1px solid #333;background: rgba(20, 20, 20, 0.8);color:#e0e0e0;font-size:15px;box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);transition: all 0.3s ease;border: 1px solid #444;resize: vertical;">${def ?? ""}</textarea>
        </div>
      `;

      const buttons = {
        ok: {
          label: "Далее",
          callback: html => resolve((html.find("#dryh-input").val() || "").trim())
        },
        cancel: {
          label: "Отмена",
          callback: () => reject("cancelled")
        }
      };

      if (showBackButton) {
        buttons.back = {
          label: "Назад",
          callback: () => reject("back")
        };
      }

      new Dialog({ title, content, buttons, default: "ok", classes: ["dryh-dialog"] }).render(true);
    });
  }

  _askReactionsCheckboxes(points = 3, hint = "", showBackButton = false) {
    return new Promise((resolve, reject) => {
      const content = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #e0e0e0; background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); padding: 20px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);">
          <div style="margin-bottom: 15px; padding: 12px; background: rgba(30, 30, 30, 0.7); border-left: 3px solid #ff4757; border-radius: 0 8px 8px 0; font-style: italic; color: #a0a0a0; font-size: 14px; line-height: 1.5;">
            ${hint}
          </div>
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div style="text-align: center; font-size: 18px; color: #ff4757; margin-bottom: 10px;">Выберите ровно ${points} реакции</div>

            <div style="background: rgba(25, 25, 25, 0.8); padding: 15px; border-radius: 10px; border: 1px solid #333;">
              <div style="font-weight: bold; color: #4da6ff; margin-bottom: 8px;">Бей</div>
              <div style="display: flex; gap: 12px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" class="hit" style="width: 18px; height: 18px; cursor: pointer;">
                  <span style="font-size: 24px;">●</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" class="hit" style="width: 18px; height: 18px; cursor: pointer;">
                  <span style="font-size: 24px;">●</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" class="hit" style="width: 18px; height: 18px; cursor: pointer;">
                  <span style="font-size: 24px;">●</span>
                </label>
              </div>
            </div>

            <div style="background: rgba(25, 25, 25, 0.8); padding: 15px; border-radius: 10px; border: 1px solid #333;">
              <div style="font-weight: bold; color: #4da6ff; margin-bottom: 8px;">Беги</div>
              <div style="display: flex; gap: 12px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" class="flee" style="width: 18px; height: 18px; cursor: pointer;">
                  <span style="font-size: 24px;">●</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" class="flee" style="width: 18px; height: 18px; cursor: pointer;">
                  <span style="font-size: 24px;">●</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" class="flee" style="width: 18px; height: 18px; cursor: pointer;">
                  <span style="font-size: 24px;">●</span>
                </label>
              </div>
            </div>

            <div id="err" style="color:#ff4757;font-weight:bold;text-align: center;padding:10px;background: rgba(40, 20, 20, 0.7);border-radius:8px;display:none;animation: pulse 0.5s;">
              Нужно выбрать ровно ${points} реакций!
            </div>
          </div>
        </div>
        <style>
          @keyframes pulse {
            0% { opacity: 0.7; }
            50% { opacity: 1; }
            100% { opacity: 0.7; }
          }
          .dryh-dialog .dialog-buttons button {
            background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
            border: 1px solid #444;
            color: #e0e0e0;
            padding: 8px 20px;
            border-radius: 8px;
            font-weight: bold;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
          }
          .dryh-dialog .dialog-buttons button:hover {
            background: linear-gradient(135deg, #3a3a3a 0%, #252525 100%);
            border-color: #ff4757;
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.7);
          }
          .dryh-dialog .dialog-buttons button:first-child {
            background: linear-gradient(135deg, #ff4757 0%, #c43131 100%);
            border-color: #ff4757;
          }
          .dryh-dialog .dialog-buttons button:first-child:hover {
            background: linear-gradient(135deg, #ff6b6b 0%, #e04040 100%);
            box-shadow: 0 6px 20px rgba(255, 71, 87, 0.4);
          }
        </style>
      `;

      const buttons = {
        ok: {
          label: "Подтвердить выбор",
          callback: html => {
            const hit = html.find(".hit:checked").length;
            const flee = html.find(".flee:checked").length;
            const errorElement = html.find("#err");

            if (hit + flee !== points) {
              errorElement.show();
              throw new Error("Invalid reactions count");
            }

            resolve({ hit, flee });
            return true;
          }
        },
        cancel: {
          label: "Отмена",
          callback: () => reject("cancelled")
        }
      };

      if (showBackButton) {
        buttons.back = {
          label: "Назад",
          callback: () => reject("back")
        };
      }

      new Dialog({
        title: "Реакции персонажа",
        content,
        buttons,
        close: () => reject("closed"),
        classes: ["dryh-dialog"]
      }).render(true);
    });
  }

  async _updateObject(event, formData) {
    const update = {};
    if (formData.name !== undefined) update.name = formData.name;

    const infoFields = ["role", "whatKeepsMeUp", "whatJustHappened", "appearance", "whoIReallyAm", "path"];
    for (const f of infoFields) {
      const key = `system.info.${f}`;
      if (formData[key] !== undefined) update[key] = formData[key];
    }

    if (formData["system.skills.madness"] !== undefined) update["system.skills.madness"] = formData["system.skills.madness"];
    if (formData["system.skills.exhaustion"] !== undefined) update["system.skills.exhaustion"] = formData["system.skills.exhaustion"];

    const countChecked = (sel) => this.element.find(sel).toArray().filter(i => i.checked).length;

    update["system.attributes.discipline"] = countChecked('input[name="disc-box"]');
    update["system.attributes.madness"] = countChecked('input[name="mad-box"]');
    update["system.attributes.exhaustion"] = countChecked('input[name="exh-box"]');
    update["system.reactions.hit"] = countChecked('input[name="hit-box"]');
    update["system.reactions.flee"] = countChecked('input[name="flee-box"]');

    return this.object.update(update);
  }
}

import { 
  makeBoxes,
  countSuccesses, 
  countValue, 
  sliceResultsIntoGroups, 
  determineDominantPool,
  getDiceStyles, 
  makeDieHtml, 
  createRollMessageContent,
  handlePostRollUpdates,
  getAskReactionsCheckboxesHTML,
  getAskHTML,
  getAwakeStats
} from "./utils.js";


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
    const system = data.actor.system;

    data.disciplineBoxes = makeBoxes(system.discipline.value, system.discipline.max);
    data.madnessBoxes = makeBoxes(system.madness.value, system.madness.max);
    data.exhaustionBoxes = makeBoxes(system.exhaustion.value, system.exhaustion.max);
    data.hitBoxes = makeBoxes(system.reactionHit.value, system.reactionHit.max);
    data.fleeBoxes = makeBoxes(system.reactionsFlee.value, system.reactionsFlee.max);

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

    const discipline = this.actor.system.discipline.value;
    const madness = this.actor.system.madness.value;
    const exhaustion = this.actor.system.exhaustion.value;
    const totalDice = discipline + madness + exhaustion + madnessDice + exhaustionDice;

    if (totalDice <= 0) {
      ui.notifications.warn("Нет кубиков для броска");
      return;
    }

    const formula = `${totalDice}d6`;
    const roll = new Roll(formula);
    await roll.evaluate({ async: true });

    const results = roll.dice[0].results;

    const [disciplineResults, madnessResults, exhaustionResults] = sliceResultsIntoGroups(
      results, 
      [discipline, madness + madnessDice, exhaustion + exhaustionDice]
    );

    const totalSuccesses = countSuccesses(disciplineResults) + 
                          countSuccesses(madnessResults) + 
                          countSuccesses(exhaustionResults);

    const dominantPool = determineDominantPool({
      discipline: { results: disciplineResults, name: "Дисциплина" },
      madness: { results: madnessResults, name: "Безумие" },
      exhaustion: { results: exhaustionResults, name: "Истощение" }
    });

    const baseStyles = getDiceStyles();

    const diceHtml = [
      ...disciplineResults.map(r => makeDieHtml(r, baseStyles.discipline)),
      ...madnessResults.map(r => makeDieHtml(r, baseStyles.madness)),
      ...exhaustionResults.map(r => makeDieHtml(r, baseStyles.exhaustion))
    ].join("");

    if (game.dice3d) {
      await game.dice3d.showForRoll(roll, game.user, !roll.isPrivate, null, false);
    }

    const messageContent = createRollMessageContent(
      this.actor.name,
      formula,
      diceHtml,
      totalSuccesses,
      dominantPool,
      discipline,
      madness + madnessDice,
      exhaustion + exhaustionDice
    );

    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: messageContent,
      whisper: roll.isPrivate,
      sound: CONFIG.sounds.dice
    });

    const needsRerender = await handlePostRollUpdates(
      this.actor, 
      madnessDice, 
      exhaustionDice
    );

    if (needsRerender) {
      this.render();
    }
  }

  async _startAwakening() {
    const actor = this.actor;
    const steps = getAwakeStats(
      actor.name,
      actor.system.info.role,
      actor.system.info.whatKeepsMeUp,
      actor.system.info.whatJustHappened,
      actor.system.info.appearance,
      actor.system.info.whoIReallyAm,
      actor.system.info.path,
      actor.system.skills.madness,
      actor.system.skills.exhaustion
    );

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
      "system.reactionHit.value": answers.reactions.hit,
      "system.reactionsFlee.value": answers.reactions.flee,
      "system.discipline.value": 3,
      "system.exhaustion.value": 0,
      "system.madness.value": 0,
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
      const content = getAskHTML(def, hint);

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
      const content = getAskReactionsCheckboxesHTML(points, hint);

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

    update["system.discipline.value"] = countChecked('input[name="disc-box"]');
    update["system.madness.value"] = countChecked('input[name="mad-box"]');
    update["system.exhaustion.value"] = countChecked('input[name="exh-box"]');
    update["system.reactionHit.value"] = countChecked('input[name="hit-box"]');
    update["system.reactionsFlee.value"] = countChecked('input[name="flee-box"]');

    return this.object.update(update);
  }
}

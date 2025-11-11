export default class DryhActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dryh", "sheet", "actor"],
      template: "systems/dryh/templates/actor-sheet.html",
      width: 920,
      height: 760,
      tabs: [{ nav: ".sheet-tabs", content: ".sheet-body", initial: "main" }]
    });
  }

  getData() {
    const data = super.getData();

    const system = data.actor.system ?? data.actor.data?.data ?? {};

    system.attributes = system.attributes || {
        discipline: 0,
        madness: 0,
        exhaustion: 0
    };

    system.reactions = system.reactions || {
        hit: 0,
        flee: 0
    };

    system.info = system.info || {
        role: "",
        whatKeepsMeUp: "",
        whatJustHappened: "",
        appearance: "",
        whoIReallyAm: "",
        path: ""
    };

    system.skills = system.skills || {
        madness: "",
        exhaustion: ""
    };

    if (data.actor.system) data.actor.system = system;
    else data.actor.data.data = system;

    const makeBoxes = (value, max) =>
        Array.from({ length: max }, (_, i) => i < (Number(value) || 0));

    data.disciplineBoxes = makeBoxes(system.attributes.discipline, 3);
    data.madnessBoxes = makeBoxes(system.attributes.madness, 3);
    data.exhaustionBoxes = makeBoxes(system.attributes.exhaustion, 6);

    data.hitBoxes = makeBoxes(system.reactions.hit, 3);
    data.fleeBoxes = makeBoxes(system.reactions.flee, 3);

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".btn-reset-exhaustion").click(async ev => {
      ev.preventDefault();
      await this.object.update({ "system.attributes.exhaustion": 0 });
    });
  }

  async _updateObject(event, formData) {
    const update = {};

    if (formData.name !== undefined) {
      update.name = formData.name;
    }

    const infoFields = [
      "role",
      "whatKeepsMeUp",
      "whatJustHappened",
      "appearance",
      "whoIReallyAm",
      "path"
    ];

    for (const f of infoFields) {
      const key = `system.info.${f}`;
      if (formData[key] !== undefined) {
        update[key] = formData[key];
      }
    }

    if (formData["system.skills.madness"] !== undefined) {
      update["system.skills.madness"] = formData["system.skills.madness"];
    }

    if (formData["system.skills.exhaustion"] !== undefined) {
      update["system.skills.exhaustion"] = formData["system.skills.exhaustion"];
    }

    const disciplineChecked = this.element
      .find('input[name="disc-box"]')
      .toArray()
      .filter(i => i.checked).length;

    const madnessChecked = this.element
      .find('input[name="mad-box"]')
      .toArray()
      .filter(i => i.checked).length;

    const exhaustionChecked = this.element
      .find('input[name="exh-box"]')
      .toArray()
      .filter(i => i.checked).length;

    const hitChecked = this.element
      .find('input[name="hit-box"]')
      .toArray()
      .filter(i => i.checked).length;

    const fleeChecked = this.element
      .find('input[name="flee-box"]')
      .toArray()
      .filter(i => i.checked).length;

    update["system.attributes.discipline"] = disciplineChecked;
    update["system.attributes.madness"] = madnessChecked;
    update["system.attributes.exhaustion"] = exhaustionChecked;

    update["system.reactions.hit"] = hitChecked;
    update["system.reactions.flee"] = fleeChecked;

    return this.object.update(update);
  }
}


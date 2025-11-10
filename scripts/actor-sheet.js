class DRYHActorSheet extends ActorSheet {
static get defaultOptions() {
return mergeObject(super.defaultOptions, {
    classes: ["dryh", "sheet", "actor"],
    template: "systems/dont-rest-your-head/templates/actor-sheet.html",
    width: 700,
    height: 760,
    tabs: [{ nav: ".sheet-tabs", content: ".sheet-body", initial: "main" }]
    });
}


getData() {
    const data = super.getData();
    data.actor.data.data.attributes = data.actor.data.data.attributes || {};
    data.actor.data.data.reactions = data.actor.data.data.reactions || {};
    data.actor.data.data.info = data.actor.data.data.info || {};
    data.actor.data.data.skills = data.actor.data.data.skills || {};
    return data;
}


activateListeners(html) {
    super.activateListeners(html);
    html.find('.btn-reset-exhaustion').click(ev => {
    ev.preventDefault();
    this.object.update({"data.exhaustion": 0});
    });
}


async _updateObject(event, formData) {
    return this.object.update(formData);
    }
}


Hooks.once('init', () => {
    console.log('DRYH | Initializing Don\'t Rest Your Head system');
    Actors.registerSheet('dont-rest-your-head', DRYHActorSheet, { types: ['character'], makeDefault: true });
});
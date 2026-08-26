import DryhItemSheet from "./item-sheet.js";
import DryhActorSheet from "./actor-sheet.js";
import {addExhaustionDice, addHopeToRoll} from "./utils.js";

Hooks.once("init", function(){
    console.log("dryh | Initialising Dont Rest Your Head System")
    game.hopeAndDespair = {
        hope: 0,
        despair: 0
    }

    Items.unregisterSheet("core", ItemSheet)
    Items.registerSheet("dryhe", DryhItemSheet, { makeDefault: true })

    Actors.unregisterSheet("core", ActorSheet)
    Actors.registerSheet("dryhe", DryhActorSheet, { makeDefault: true })
})

Hooks.on("getSceneControlButtons", (controls) => {
    console.log("DRYH | Add button to tools");
    if (!game.user.isGM) return;
    controls.tokens.tools.useDespair = {
        name: "useDespair",
        title: "Use Despair",
        icon: "fas fa-moon",
        button: true,
        onClick: () => {
            console.log("DRYH | Use Despair");
            if (game.hopeAndDespair.despair < 1) return;
            game.hopeAndDespair.despair -= 1;
            game.hopeAndDespair.hope += 1;
        }
    };

    controls.tokens.tools.addDespair = {
        name: "addDespair",
        title: "Add Despair",
        icon: "fas fa-sun",
        button: true,
        onClick: () => {
            console.log("DRYH | Add Despair");
            game.hopeAndDespair.despair += 1;
        }
    };
});

Hooks.on("renderChatMessageHTML", (message, html) => {
    const rollData = message.getFlag("dryh", "rollData");
    if (rollData && rollData.canAddExhaustion) {
        addHopeToRoll(message, html, rollData);
        addExhaustionDice(message, html, rollData);
    }
});
import DryhItemSheet from "./item-sheet.js";
import DryhActorSheet from "./actor-sheet.js";

Hooks.once("init", function(){
    console.log("dryh | Initialising Dont Rest Your Head System")

    Items.unregisterSheet("core", ItemSheet)
    Items.registerSheet("dryhe", DryhItemSheet, { makeDefault: true })

    Actors.unregisterSheet("core", ActorSheet)
    Actors.registerSheet("dryhe", DryhActorSheet, { makeDefault: true })
})
export default class DryhItemSheet extends ItemSheet {
    get template() {
        return `systems/dryh/templates/${this.item.type}-sheet.html`;
    }
}
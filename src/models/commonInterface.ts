import { BaseInterface, PropertyChangedCallback, CommandCallback, Property } from "azure-iot-digitaltwins-device";

export default class CommonInterface extends BaseInterface {
    constructor(interfaceName: string, interfaceId: string, propertyCallback: PropertyChangedCallback, commandCallback: CommandCallback) {
        super(interfaceName, interfaceId, propertyCallback, commandCallback);
        this.name = new Property(true);
    }
}
import { BaseInterface, PropertyChangedCallback, CommandCallback, Property, Command, Telemetry } from "azure-iot-digitaltwins-device";

export default class CommonInterface extends BaseInterface {
    [index: string]: any;
    constructor(interfaceName: string, interfaceId: string, propertyCallback: PropertyChangedCallback, commandCallback: CommandCallback) {
        super(interfaceName, interfaceId, propertyCallback, commandCallback);
        this.name = new Property(true);
    }

    addProperty(propertyName: string, writeable: boolean = false) {
        this[propertyName] = new Property(writeable);
    }

    addCommand(commandName) {
        this[commandName] = new Command();
    }

    addTelemetry(telemetryName) {
        this[telemetryName] = new Telemetry();
    }
}
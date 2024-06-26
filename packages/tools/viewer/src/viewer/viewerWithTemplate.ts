import { AbstractViewer } from "./viewer";
import { ConfigurationLoader } from "../configuration/loader";

/**
 * The AbstractViewer is the center of Babylon's viewer.
 * It is the basic implementation of the default viewer and is responsible of loading and showing the model and the templates
 */
export abstract class AbstractViewerWithTemplate extends AbstractViewer {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    protected override getConfigurationLoader() {
        return new ConfigurationLoader();
    }
}

import type { IFlowGraphBlockConfiguration } from "./flowGraphBlock";
import { FlowGraphExecutionBlock } from "./flowGraphExecutionBlock";
import type { FlowGraphSignalConnection } from "./flowGraphSignalConnection";

/**
 * An execution block that has an out signal. This signal is triggered when the synchronous execution of this block is done.
 * Most execution blocks will inherit from this, except for the ones that have multiple signals to be triggered.
 * (such as if blocks)
 */
export abstract class FlowGraphExecutionBlockWithOutSignal extends FlowGraphExecutionBlock {
    /**
     * Output connection: The signal that is synchronous triggered when the execution of this block is done.
     * Note that is case of events or async you might want to use the `done` signal instead.
     */
    public readonly out: FlowGraphSignalConnection;

    protected constructor(config?: IFlowGraphBlockConfiguration) {
        super(config);
        this.out = this._registerSignalOutput("out");
    }
}

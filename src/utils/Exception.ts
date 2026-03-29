type Reason = Error | string;


export class Exception extends Error
{
    
    public code : number;
    
    protected _reasons : Reason[] = [];
    
    public get reasons () : Reason[] { return this._reasons; }
    
    
    public constructor (
        message : string,
        code : number = -1,
        error ? : Reason,
    )
    {
        super(message);
        this.code = code;
        
        if (error) {
            this._reasons = error instanceof Exception
                ? error.reasons.concat([ error ])
                : [ error ]
            ;
            
            this._initErrorMessage(this.message, error);
        }
    }
    
    public toString () : string
    {
        return `Exception #${this.code}: ${this.message}`;
    }
    
    protected _initErrorMessage (message, error) : void
    {
        // @ts-ignore - it depends on the environment
        const captureStackTrace = Error.captureStackTrace;
        if (typeof captureStackTrace === 'function') {
            captureStackTrace(this, this.constructor);
        }
        else {
            this.stack = (new Error(message)).stack;
        }
        
        const messageLines = (this.message.match(/\n/g) || []).length + 1;
        this.stack = this.constructor.name + ': [' + this.code + '] ' + message + '\n' +
            this.stack.split('\n').slice(1, messageLines + 1).join('\n')
            + '\n'
            + error.stack;
    }
    
}

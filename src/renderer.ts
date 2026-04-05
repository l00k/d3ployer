import chalk from 'chalk';
import {
    color,
    LISTR_LOGGER_STDERR_LEVELS,
    LISTR_LOGGER_STYLE,
    ListrLogger,
    ListrLogLevels,
    ListrTaskEventType,
    ListrTaskState,
    PRESET_TIMER,
} from 'listr2';


export class CustomRenderer
{
    static nonTTY = true;
    static rendererOptions = {
        pausedTimer: {
            ...PRESET_TIMER,
            field: (time : any) => `${ListrLogLevels.PAUSED}:${time}`,
            format: () => color.yellowBright,
        },
    };
    static rendererTaskOptions = {};
    
    private tasks : any;
    private options : any;
    private logger : ListrLogger;
    private cache = {
        rendererOptions: new Map<string, any>(),
        rendererTaskOptions: new Map<string, any>(),
    };
    private skipped : Set<string> = new Set();
    private pendingStart : Map<string, () => void> = new Map();
    
    constructor (tasks : any, options : any)
    {
        this.tasks = tasks;
        this.options = {
            ...CustomRenderer.rendererOptions,
            ...options,
            icon: {
                ...LISTR_LOGGER_STYLE.icon,
                ...options?.icon ?? {},
            },
            color: {
                ...LISTR_LOGGER_STYLE.color,
                ...options?.color ?? {},
            },
        };
        this.logger = this.options.logger ?? new ListrLogger({
            useIcons: true,
            toStderr: LISTR_LOGGER_STDERR_LEVELS,
        });
        this.logger.options.icon = this.options.icon;
        this.logger.options.color = this.options.color;
        if (this.options.timestamp) {
            this.logger.options.fields.prefix.unshift(this.options.timestamp);
        }
    }
    
    end () : void {}
    
    render () : void
    {
        this.renderer(this.tasks);
    }
    
    private formatTitle (title : string) : string
    {
        return chalk.bgCyan.black(` ${title} `);
    }
    
    renderer (tasks : any[]) : void
    {
        tasks.forEach((task) => {
            this.calculate(task);
            
            task.once(ListrTaskEventType.CLOSED, () => {
                this.reset(task);
            });
            
            const rendererTaskOptions = this.cache.rendererTaskOptions.get(task.id);
            
            task.on(ListrTaskEventType.SUBTASK, (subtasks : any) => {
                this.renderer(subtasks);
            });
            
            task.on(ListrTaskEventType.STATE, (state : any) => {
                if (!task.hasTitle()) return;
                
                const title = this.formatTitle(task.title);
                
                if (state === ListrTaskState.STARTED) {
                    this.pendingStart.set(task.id, () => {
                        this.logger.log(ListrLogLevels.STARTED, title);
                    });
                }
                else if (state === ListrTaskState.COMPLETED) {
                    if (this.skipped.has(task.id)) return;
                    
                    this.pendingStart.get(task.id)?.();
                    this.pendingStart.delete(task.id);
                    
                    const timer = rendererTaskOptions?.timer;
                    this.logger.log(ListrLogLevels.COMPLETED, title, timer && {
                        suffix: {
                            ...timer,
                            condition: !!task.message?.duration && timer.condition,
                            args: [ task.message.duration ],
                        },
                    });
                }
                else if (state === ListrTaskState.PROMPT) {
                    this.logger.process.hijack();
                    task.on(ListrTaskEventType.PROMPT, (prompt : any) => {
                        this.logger.process.toStderr(prompt, false);
                    });
                }
                else if (state === ListrTaskState.PROMPT_COMPLETED) {
                    task.off(ListrTaskEventType.PROMPT);
                    this.logger.process.release();
                }
            });
            
            task.on(ListrTaskEventType.OUTPUT, (output : any) => {
                this.pendingStart.get(task.id)?.();
                this.pendingStart.delete(task.id);
                this.logger.log(ListrLogLevels.OUTPUT, output);
            });
            
            task.on(ListrTaskEventType.MESSAGE, (message : any) => {
                const title = this.formatTitle(task.title);
                
                if (message.error) {
                    this.pendingStart.get(task.id)?.();
                    this.pendingStart.delete(task.id);
                    this.logger.log(ListrLogLevels.FAILED, title, {
                        suffix: {
                            field: `${ListrLogLevels.FAILED}: ${message.error}`,
                            format: () => color.red,
                        },
                    });
                }
                else if (message.skip) {
                    this.pendingStart.delete(task.id);
                    this.skipped.add(task.id);
                    process.stdout.write(
                        chalk.gray('Task ')
                        + chalk.cyan(task.title)
                        + chalk.gray(` skipped: ${message.skip}\n`),
                    );
                }
                else if (message.rollback) {
                    this.pendingStart.get(task.id)?.();
                    this.pendingStart.delete(task.id);
                    this.logger.log(ListrLogLevels.ROLLBACK, title, {
                        suffix: {
                            field: `${ListrLogLevels.ROLLBACK}: ${message.rollback}`,
                            format: () => color.red,
                        },
                    });
                }
                else if (message.retry) {
                    this.pendingStart.get(task.id)?.();
                    this.pendingStart.delete(task.id);
                    this.logger.log(ListrLogLevels.RETRY, title, {
                        suffix: {
                            field: `${ListrLogLevels.RETRY}:${message.retry.count}`,
                            format: () => color.red,
                        },
                    });
                }
                else if (message.paused) {
                    const rendererOptions = this.cache.rendererOptions.get(task.id);
                    const timer = rendererOptions?.pausedTimer;
                    this.logger.log(ListrLogLevels.PAUSED, title, timer && {
                        suffix: {
                            ...timer,
                            condition: !!message?.paused && timer.condition,
                            args: [ message.paused - Date.now() ],
                        },
                    });
                }
            });
        });
    }
    
    calculate (task : any) : void
    {
        if (this.cache.rendererOptions.has(task.id) && this.cache.rendererTaskOptions.has(task.id)) return;
        
        const rendererOptions = {
            ...this.options,
            ...task.rendererOptions,
        };
        this.cache.rendererOptions.set(task.id, rendererOptions);
        this.cache.rendererTaskOptions.set(task.id, {
            ...CustomRenderer.rendererTaskOptions,
            timer: rendererOptions.timer,
            ...task.rendererTaskOptions,
        });
    }
    
    reset (task : any) : void
    {
        this.cache.rendererOptions.delete(task.id);
        this.cache.rendererTaskOptions.delete(task.id);
        this.skipped.delete(task.id);
        this.pendingStart.delete(task.id);
    }
}

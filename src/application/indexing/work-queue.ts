/** Default concurrent scan workers on desktop (§7.2). */
export const SCAN_CONCURRENCY_DESKTOP = 2;

/** Default concurrent scan workers on mobile (§7.2). */
export const SCAN_CONCURRENCY_MOBILE = 1;

/** Items scheduled per micro-batch before yielding to the event loop (§7.2). */
export const DEFAULT_MICRO_BATCH_SIZE = 32;

export function resolveScanConcurrency(isMobile: boolean): number {
	return isMobile ? SCAN_CONCURRENCY_MOBILE : SCAN_CONCURRENCY_DESKTOP;
}

/** Yields one macrotask so the UI thread can process input (browser / Obsidian). */
export function defaultYieldToEventLoop(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

export interface BoundedWorkQueue {
	readonly concurrency: number;
	readonly batchSize: number;
	/** Tasks currently executing (not waiting in the FIFO). */
	readonly activeCount: number;
	/** Tasks waiting for a worker slot. */
	readonly pendingCount: number;
	run<T>(task: () => Promise<T>): Promise<T>;
	/** Schedules many tasks; yields between enqueue micro-batches. */
	runMany(tasks: ReadonlyArray<() => Promise<void>>): Promise<void>;
	/** Resolves when no tasks are running or queued. */
	whenIdle(): Promise<void>;
}

export interface BoundedWorkQueueOptions {
	concurrency: number;
	batchSize?: number;
	yield?: () => Promise<void>;
}

export function createBoundedWorkQueue(
	options: BoundedWorkQueueOptions,
): BoundedWorkQueue {
	const concurrency = Math.floor(options.concurrency);
	if (!Number.isFinite(concurrency) || concurrency < 1) {
		throw new Error(
			`BoundedWorkQueue concurrency must be >= 1, got ${options.concurrency}`,
		);
	}
	const batchSize = Math.max(
		1,
		Math.floor(options.batchSize ?? DEFAULT_MICRO_BATCH_SIZE),
	);
	const yieldToEventLoop = options.yield ?? defaultYieldToEventLoop;

	return new BoundedWorkQueueImpl(concurrency, batchSize, yieldToEventLoop);
}

type QueueEntry<T> = {
	readonly task: () => Promise<T>;
	readonly resolve: (value: T) => void;
	readonly reject: (reason: unknown) => void;
};

class BoundedWorkQueueImpl implements BoundedWorkQueue {
	private readonly fifo: Array<QueueEntry<unknown>> = [];
	private active = 0;
	private idleWaiters: Array<() => void> = [];

	constructor(
		readonly concurrency: number,
		readonly batchSize: number,
		private readonly yieldToEventLoop: () => Promise<void>,
	) {}

	get activeCount(): number {
		return this.active;
	}

	get pendingCount(): number {
		return this.fifo.length;
	}

	run<T>(task: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.fifo.push({
				task,
				resolve: resolve as (value: unknown) => void,
				reject,
			});
			this.pump();
		});
	}

	async runMany(tasks: ReadonlyArray<() => Promise<void>>): Promise<void> {
		if (tasks.length === 0) {
			return;
		}

		const scheduled: Array<Promise<void>> = [];
		for (let i = 0; i < tasks.length; i += this.batchSize) {
			const end = Math.min(i + this.batchSize, tasks.length);
			for (let j = i; j < end; j++) {
				scheduled.push(this.run(tasks[j]!));
			}
			if (end < tasks.length) {
				await this.yieldToEventLoop();
			}
		}
		await Promise.all(scheduled);
	}

	whenIdle(): Promise<void> {
		if (this.active === 0 && this.fifo.length === 0) {
			return Promise.resolve();
		}
		return new Promise((resolve) => {
			this.idleWaiters.push(resolve);
		});
	}

	private pump(): void {
		while (this.active < this.concurrency && this.fifo.length > 0) {
			const entry = this.fifo.shift()!;
			this.active++;
			void this.execute(entry);
		}
		this.resolveIdleWaitersIfReady();
	}

	private async execute(entry: QueueEntry<unknown>): Promise<void> {
		try {
			const result = await entry.task();
			entry.resolve(result);
		} catch (err: unknown) {
			entry.reject(err);
		} finally {
			this.active--;
			this.pump();
		}
	}

	private resolveIdleWaitersIfReady(): void {
		if (this.active > 0 || this.fifo.length > 0) {
			return;
		}
		const waiters = this.idleWaiters;
		this.idleWaiters = [];
		for (const resolve of waiters) {
			resolve();
		}
	}
}

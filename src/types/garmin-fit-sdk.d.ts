declare module "@garmin-fit/sdk" {
	export class Stream {
		static fromByteArray(bytes: Uint8Array): Stream;
	}

	export default class Decoder {
		constructor(stream: Stream);
		isFIT(): boolean;
		read(): {
			messages: Record<string, unknown[]>;
			errors: unknown[];
		};
	}

	export { Decoder, Stream };
}

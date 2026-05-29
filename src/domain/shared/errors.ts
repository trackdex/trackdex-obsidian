/** Stable error codes for domain and port boundaries. */
export type DomainErrorCode =
	| "parse_failed"
	| "invalid_geometry"
	| "not_found"
	| "storage_error"
	| "validation_failed";

export interface DomainError {
	readonly code: DomainErrorCode;
	readonly message: string;
	readonly cause?: unknown;
}

export function domainError(
	code: DomainErrorCode,
	message: string,
	cause?: unknown,
): DomainError {
	return { code, message, cause };
}

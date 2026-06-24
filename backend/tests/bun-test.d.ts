type BunTestMatcher = {
	not: BunTestMatcher;
	toBe(expected: unknown): void;
	toEqual(expected: unknown): void;
	toBeNull(): void;
	toBeTruthy(): void;
	toBeDefined(): void;
	toBeUndefined(): void;
	toContain(expected: unknown): void;
	toHaveLength(expected: number): void;
	toMatch(expected: RegExp | string): void;
	toMatchObject(expected: unknown): void;
};

declare module "bun:test" {
	export const beforeAll: (fn: () => unknown | Promise<unknown>) => void;
	export const afterAll: (fn: () => unknown | Promise<unknown>) => void;
	export const describe: (name: string, fn: () => void) => void;
	export const test: (
		name: string,
		fn: () => unknown | Promise<unknown>,
	) => void;
	export const expect: (actual: unknown) => BunTestMatcher;
}

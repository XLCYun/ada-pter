import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
} from "vitest";

type BunLikeMock = {
  <T extends (...args: any[]) => any>(impl?: T): ReturnType<typeof vi.fn<T>>;
  module: (name: string, factory: () => any) => void;
};

const mock = ((impl?: (...args: any[]) => any) => vi.fn(impl)) as BunLikeMock;

// Bun exposes mock.module(); mirror it for Node/Vitest test runs.
mock.module = (name, factory) => {
  vi.doMock(name, factory);
};

export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  test,
  vi,
};

# package.json, as installed

Two files exist. `client/package.json` describes the browser app. `server/package.json` describes the Express app. A library listed in one is not available to the other. There is no third package file for `shared/`.

`package.json` is the project’s own list of commands and libraries. npm reads it when you install or run the project. `package-lock.json` is npm’s exact install record. Leave it closed. `node_modules/` is the downloaded code. Leave it closed. It stays out of git.

Open a file from the explorer, or press Command-P and type `package.json`.

## Fields, in the order both files use

1. **name.** `client` or `server`.
2. **private.** `true`. The project stays in this repository. It is not published as a public npm library.
3. **version.** `0.0.0`. That is the starter version, not a SENTINEL milestone and not an Army publication version.
4. **type.** `"module"`. The code uses `import` and `export`.
5. **scripts.** Commands you run with `npm run`, from that project’s folder.
6. **dependencies.** Libraries the running program uses.
7. **devDependencies.** Tools used to write, check, and build the program.

A version such as `^19.3.1` is the release the file asked for. The caret lets npm install a later compatible release. The name to the left of the version is the library.

## Client

Scripts:

| Script | What it runs |
| --- | --- |
| `dev` | `vite`. Serves the page while you work. |
| `build` | `tsc -b && vite build`. Typecheck, then a production copy. |
| `lint` | `oxlint`. Reports likely mistakes. It does not draw the page. |
| `preview` | `vite preview`. Serves the production copy. |

Libraries:

| Name | Where it sits | What it does |
| --- | --- | --- |
| `react` | dependencies | Draws the page as components. `App.tsx` is one component. |
| `react-dom` | dependencies | Puts those components into the browser page. |
| `vite` | devDependencies | Serves the client while you work, and builds it later. |
| `@vitejs/plugin-react` | devDependencies | Teaches Vite how to load a React file. |
| `typescript` | devDependencies | Checks that fields have the shape the code claims. |
| `@types/react` | devDependencies | TypeScript’s description of React. |
| `@types/react-dom` | devDependencies | TypeScript’s description of react-dom. |
| `@types/node` | devDependencies | TypeScript’s description of Node. The Vite config uses it. |
| `oxlint` | devDependencies | The checker behind `npm run lint`. |
| `tailwindcss` | devDependencies | The style vocabulary used in the markup. |
| `@tailwindcss/vite` | devDependencies | Connects Tailwind to Vite. |

`@types/...` is a description for the editor and the type checker. It is not a second copy of the library.

## Server

Scripts:

| Script | What it runs |
| --- | --- |
| `dev` | `tsx src/index.ts`. Starts the API. |
| `typecheck` | `tsc --noEmit`. Checks the code and writes nothing. |
| `test` | `tsx --test src/workflow.test.ts`. Runs the workflow tests. |

Libraries:

| Name | Where it sits | What it does |
| --- | --- | --- |
| `express` | dependencies | Receives HTTP requests and sends responses. |
| `typescript` | devDependencies | Same job as in the client: check the shape of the code. |
| `tsx` | devDependencies | Runs a TypeScript file during development and for the tests. |
| `@types/express` | devDependencies | TypeScript’s description of Express. |
| `@types/node` | devDependencies | TypeScript’s description of Node. |

Express is the only server library. SQLite is Node’s built-in `node:sqlite`, so it does not appear in this file. Playwright is installed outside the repository, so it does not appear here either.

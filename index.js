const { sync: glob } = require("fast-glob");
const path = require("path");
const ts = require("typescript");
const normalizePath = process.platform === "win32" ? require("normalize-path") : (x) => x;
module.exports = (relativeTsconfigPath = "./tsconfig.json") => {
  const cwd = process.cwd();
  const tsconfigFile = ts.findConfigFile(cwd, ts.sys.fileExists, relativeTsconfigPath);
  const configFile = ts.readConfigFile(tsconfigFile, ts.sys.readFile);
  const tsconfigData = ts.parseJsonConfigFileContent(configFile.config, ts.sys, cwd);
  const { options: compilerOptions } = tsconfigData;
  const pathKeys = Object.keys(compilerOptions.paths);
  const re = new RegExp(`^(${pathKeys.join("|")})`);
  return {
    name: "esbuild-ts-paths",
    setup(build) {
      build.onResolve({ filter: re }, (args) => {
        const pathKey = pathKeys.find((pkey) => new RegExp(`^${pkey}`).test(args.path));
        const [pathDir] = pathKey.split("*");
        let file = args.path.replace(pathDir, "");
        if (file === args.path) {
          // if importing from root of alias
          file = "";
        }
        for (const dir of compilerOptions.paths[pathKey]) {
          const fileDir = normalizePath(path.resolve(process.cwd(), dir).replace("*", file));
          let [matchedFile] = glob(`${fileDir}.*`);
          if (!matchedFile) {
            const [matchIndexFile] = glob(`${fileDir}/index.*`);
            matchedFile = matchIndexFile;
          }
          if (matchedFile) {
            return { path: matchedFile };
          }
        }
        return { path: args.path };
      });
    },
  };
};

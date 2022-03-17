/* eslint-disable */
const { DefinePlugin } = require("webpack");
const fs = require("fs");
const path = require("path");
const modAuthor = require("../package.json").author;

const cssLoaders = ["to-string-loader", "css-loader"];
const buildDir = process.env.NODE_ENV == "production" ? "prod" : ".";

const config = {
    entry: {},
    output: {
        path: path.resolve("./build/", buildDir),
        filename: "[name].mod.js"
    },
    module: {
        rules: [
            { test: /\.less$/, use: [...cssLoaders, "less-loader"] },
            { test: /\.css$/, use: cssLoaders },
            { test: /\.(webp|png|svg|woff2)$/, type: "asset/inline" },
            { test: /\.md$/, use: ["html-loader", "markdown-loader"] }
        ]
    },
    plugins: [
        new DefinePlugin({
            registerMod: `((cls, info) => {
                info.author = ${JSON.stringify(
                    modAuthor.replaceAll("<", "&lt;")
                )};
                if (!("website" in info)) info.website = "";
                window.$shapez_registerMod(cls, info);
            })`
        })
    ]
};

generateEntries(
    fs
        .readdirSync("./src")
        .filter((dir) => fs.existsSync(path.join("./src", dir, "mod.json")))
);

if (fs.existsSync("./types.d.ts")) {
    const types = fs.readFileSync("./types.d.ts", "utf-8");
    const modules = types
        .split(/declare\smodule\s"/gm)
        .map((m) => m.slice(0, m.indexOf('"')))
        .join("|");

    // This regex is still incomplete. I will try to improve it
    // next time it fails.
    const regex = new RegExp(
        `import\\s{([\\w\\d\\s,]*?)}\\sfrom\\s"(${modules})";`,
        "gms"
    );
    config.module.rules.push({
        test: /\.js$/,
        loader: "string-replace-loader",
        options: {
            search: regex,
            replace: (_, imports) => `const {${imports}} = shapez;`
        },
        exclude: /node_modules/
    });
} else {
    console.warn("Failed to find types.d.ts, imports won't be mapped.");
}

function generateEntries(mods) {
    for (const dir of mods) {
        const jsonPath = path.resolve("./src", dir, "mod.json");
        const { entry } = require(jsonPath);

        config.entry[dir] = path.resolve("./src", dir, entry);
    }
}

module.exports = config;

import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: process.env.NODE_ENV || "development",
  entry: path.resolve(__dirname, "./src/client/index.tsx"),
  output: {
    path: path.resolve(__dirname, "./public"),
    filename: "bundle.[contenthash].js",
    publicPath: "./", // Relative path so bundle loads from current directory
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: path.resolve(__dirname, "./tsconfig.client.json"),
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".jsx"],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "./src/client/index.template.html"),
      inject: "body",
      publicPath: "auto", // Let webpack handle it
    }),
  ],
  devtool: process.env.NODE_ENV === "production" ? "source-map" : "eval-source-map",
};

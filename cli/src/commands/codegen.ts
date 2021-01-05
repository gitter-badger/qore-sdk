import { Command, flags } from "@oclif/command";
import voca from "voca";
import prettier from "prettier";
import { Field } from "@feedloop/qore-sdk";
import fs from "fs";
import fse from "fs-extra";
import path from "path";
import makeProject, {
  FieldType,
  Vield
} from "@feedloop/qore-sdk/lib/project/index";
import config, { CLIConfig } from "../config";
import ExportSchema from "./export-schema";
import { configFlags, promptFlags } from "../flags";

export default class Codegen extends Command {
  static warningMessage =
    "[WARNING] This file is generated by running `$ qore codegen` on your root project, please do not edit";
  static description = "Generate qore project files";

  static examples = [`$ qore codegen --project projectId --org orgId`];

  static flags = {
    ...configFlags
  };

  static writeConfigFile = async (configs: CLIConfig, destination?: string) => {
    const project = makeProject({
      organizationId: configs.org,
      projectId: configs.project
    });
    await project.auth.signInWithUserToken(configs.token);
    const authConfig = await project.authConfig();
    fse.writeJSONSync(
      path.resolve(destination || process.cwd(), "qore.config.json"),
      {
        version: "v1",
        endpoint: "https://p-qore-dot-pti-feedloop.et.r.appspot.com",
        projectId: configs.project,
        organizationId: configs.org,
        authenticationId: authConfig.password?.id,
        WARNING: Codegen.warningMessage
      },
      { spaces: 2 }
    );
  };

  private writeFieldTypes = new Set<FieldType>([
    "text",
    "number",
    "date",
    "file",
    "password",
    "select",
    "boolean",
    "select",
    "relation"
  ]);

  readFieldType(field: Field | Vield) {
    switch (field.type) {
      case "text":
      case "file":
      case "password":
        return "string";
      case "role":
        return "{id: string; displayField: string}";
      case "relation":
        if (field.multiple)
          return `{nodes: ${voca.capitalize(
            field.id === "person" ? "member" : field.id
          )}TableRow[]}`;
        return `${voca.capitalize(
          field.id === "person" ? "member" : field.id
        )}TableRow${field.multiple ? "[]" : ""}`;
      case "rollup":
        return "number";
      case "date":
        return "Date";
      case "select":
        return field.select.map(select => `"${select}"`).join("|");
      case "lookup":
      case "formula":
        if (field.returnType === "table")
          return "{id: string; displayField: string}";
        if (field.returnType === "text") return "string";
        return field.returnType;
      default:
        return field.type;
    }
  }
  writeFieldType(field: Field | Vield) {
    switch (field.type) {
      case "text":
      case "file":
      case "password":
      case "role":
        return "string";
      case "relation":
        return "string[]";
      case "date":
        return "Date";
      case "select":
        return field.select.map(select => `"${select}"`).join("|");
      default:
        return field.type;
    }
  }
  isWriteField(field: Field | Vield) {
    return this.writeFieldTypes.has(field.type);
  }

  async run() {
    try {
      const { args, flags } = this.parse(Codegen);
      const configs = await promptFlags(flags, Codegen.flags);
      const schema = await ExportSchema.getSchema(configs);
      await ExportSchema.run([
        "--project",
        configs.project,
        "--org",
        configs.org,
        "--token",
        configs.token
      ]);
      const idField = { id: "id", type: "text", name: "id" } as Field<"text">;
      const typeDef = `
      // ${Codegen.warningMessage}
      ${schema.tables
        .map(
          ({ id, fields }) => `
            type ${voca.capitalize(id)}TableRow = {${[idField, ...fields]
            .filter(field => field.type !== "action")
            .map(
              field => `
            ${field.id}: ${this.readFieldType(field)};`
            )
            .join("")}}`
        )
        .join("\n")}

    ${schema.views
      .map(
        ({ id, parameters, sorts, fields }) => `
          type ${voca.capitalize(id)}ViewRow = {
            read: {${[idField, ...fields]
              .filter(field => field.type !== "action")
              .map(
                field => `
            ${field.id}: ${this.readFieldType(field)};`
              )
              .join("")}}
            write: {${fields
              .filter(vield => this.isWriteField(vield))
              .map(
                field => `
                ${field.id}: ${this.writeFieldType(field)};`
              )
              .join("")}
            }
            params: {${parameters
              .map(
                param => `
                ${param.slug}${param.required ? "" : "?"}: ${
                  param.type === "text" ? "string" : "number"
                };`
              )
              .join("")}
              ${sorts
                .filter(sort => !!sort.order && !!sort.by)
                // group order by "sort.by"
                .reduce((group, sort) => {
                  const targetIdx = group.findIndex(
                    sortGroup => sortGroup.by === sort.by
                  );
                  if (group[targetIdx]) {
                    group[targetIdx].order.push(sort.order);
                  } else {
                    group.push({
                      by: sort.by,
                      order: [sort.order]
                    });
                  }
                  return group;
                }, [] as Array<{ by: string; order: string[] }>)
                .map(
                  sortGroup =>
                    `"$by.${sortGroup.by}"?: ${sortGroup.order
                      .map(order => `"${order}"`)
                      .join("|")};`
                )
                .join("")}
            }
            actions: {${fields
              .filter(
                (vield): vield is Field<"action"> => vield.type === "action"
              )
              .map(
                action => `${action.id}: {
                ${action.parameters.map(
                  param =>
                    `${param.slug}${!param.required && "?"}: ${
                      param.type === "text" ? "string" : param.type
                    }`
                )}
              }`
              )}
            }
          }`
      )
      .join("\n")}

      export type QoreProjectSchema = {
        ${schema.views
          .map(view => `${view.id}: ${voca.capitalize(view.id)}ViewRow;`)
          .join("")}
      }
    `;
      fs.writeFileSync(
        path.resolve(process.cwd() + "/qore-generated.ts"),
        prettier.format(typeDef, { parser: "babel-ts" }),
        {
          encoding: "utf8"
        }
      );
      await Codegen.writeConfigFile(configs);
    } catch (error) {
      console.error(error.message);
      throw error;
    }
  }
}

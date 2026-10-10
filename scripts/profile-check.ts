// Geliştirme aracı: demo dosyasının profilini terminalde gösterir.
import { readFileSync } from "node:fs";
import { readWorkbook } from "../src/lib/workbook";
import { profileWorkbook } from "../src/lib/profile";

const path = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "demo/nova_elektronik_satis_2025.xlsx";
const buf = readFileSync(path);
const file = new File([buf], path.split("/").pop()!);
readWorkbook(file).then((wb) => {
  const p = profileWorkbook(wb);
  console.log(JSON.stringify(process.argv.includes("--full") ? p : { ...p, schema: p.schema.length }, null, 2));
});

import app from "./src/app.js";
import { config } from "./src/config/config.js";
import connectDB from "./src/config/db.js";

await connectDB();
app.listen(config.port, () => console.log(`Renoble API listening on port ${config.port}`));

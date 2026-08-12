import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`KasPro API berjalan di http://localhost:${port}`);
});

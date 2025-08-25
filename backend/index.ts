import app from './app';
import connectToDb from './src/config/db';
import dotenv from 'dotenv';

dotenv.config();

connectToDb();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

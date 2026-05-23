const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/quiz.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// Seed default profile questions if none exist
const profileCount = db.prepare('SELECT COUNT(*) as c FROM profile_questions').get();
if (profileCount.c === 0) {
  const insert = db.prepare('INSERT INTO profile_questions (question_text, order_num) VALUES (?, ?)');
  const insertOpt = db.prepare('INSERT INTO profile_options (question_id, option_text) VALUES (?, ?)');

  const questions = [
    { text: 'რა არის თქვენი საყვარელი სეზონი?', opts: ['გაზაფხული', 'ზაფხული', 'შემოდგომა', 'ზამთარი'] },
    { text: 'რომელ სფეროს ამჯობინებთ?', opts: ['ტექნოლოგია', 'ხელოვნება', 'სპორტი', 'მეცნიერება'] },
    { text: 'რა არის თქვენი სამუშაო სტილი?', opts: ['გუნდური', 'დამოუკიდებელი', 'შერეული', 'სიტუაციის მიხედვით'] },
    { text: 'დილის ადამიანი ხართ?', opts: ['დიახ, სიამოვნებით', 'მეტ-ნაკლებად', 'სჯობს საღამო', 'არ მაქვს სასურველი დრო'] },
    { text: 'რომელ საკომუნიკაციო სტილს ამჯობინებთ?', opts: ['პირდაპირი კომუნიკაცია', 'ელ-ფოსტა', 'მოკლე შეტყობინება', 'ვიდეო ზარი'] },
    { text: 'რა გარემოში გიყვართ მუშაობა?', opts: ['조용ი ოფისი', 'ხმაური გარემო', 'სახლი', 'კაფე'] },
    { text: 'რა მოტივაციას იღებთ?', opts: ['კარიერული ზრდა', 'ფინანსური ჯილდო', 'გუნდური სიამოვნება', 'პიროვნული განვითარება'] },
    { text: 'რომელ ინსტრუმენტს ამჯობინებთ?', opts: ['Excel/ცხრილები', 'პროგრამები', 'ქაღალდი', 'თეთრი დაფა'] },
    { text: 'სამსახურის შემდეგ ყველაზე სიამოვნება?', opts: ['ოჯახი', 'ფიტნესი', 'კინო/სერიალი', 'კითხვა'] },
  ];

  const insertMany = db.transaction(() => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const result = insert.run(q.text, i + 1);
      for (const opt of q.opts) {
        insertOpt.run(result.lastInsertRowid, opt);
      }
    }
  });
  insertMany();
}

module.exports = db;

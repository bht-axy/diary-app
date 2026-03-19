const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径，位于项目根目录
const dbPath = path.join(__dirname, 'diary-database.sqlite');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('数据库连接成功');
  }
});

// 初始化数据库表结构
const initializeDatabase = () => {
  // 创建用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建日记表
  db.run(`
    CREATE TABLE IF NOT EXISTS diaries (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      title TEXT,
      content TEXT,
      plan TEXT,
      summary TEXT,
      category TEXT,
      tags TEXT,
      weather TEXT,
      date TEXT NOT NULL,
      lunar_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 创建年度计划表
  db.run(`
    CREATE TABLE IF NOT EXISTS year_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      year INTEGER NOT NULL,
      plan TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, year)
    )
  `);

  // 创建月度计划表
  db.run(`
    CREATE TABLE IF NOT EXISTS month_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      plan TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, year, month)
    )
  `);

  // 创建附件表
  db.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      diary_id TEXT,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_size INTEGER,
      file_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (diary_id) REFERENCES diaries(id)
    )
  `);

  // 插入默认用户（admin / admin123）
  const bcrypt = require('bcryptjs');
  const saltRounds = 10;
  const hashedPassword = bcrypt.hashSync('admin123', saltRounds);
  
  db.run(`
    INSERT OR IGNORE INTO users (username, password)
    VALUES (?, ?)
  `, ['admin', hashedPassword]);

  console.log('数据库表结构初始化完成');
};

// 执行初始化
initializeDatabase();

// 关闭数据库连接
db.close((err) => {
  if (err) {
    console.error('关闭数据库连接失败:', err);
  } else {
    console.log('数据库连接已关闭');
  }
});
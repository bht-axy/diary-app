const express = require('express');
const LokiJS = require('lokijs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

// 数据库连接
const dbPath = path.join(__dirname, 'diary-database.json');
const db = new LokiJS(dbPath, {
  autoload: true,
  autoloadCallback: databaseInitialize,
  autosave: true,
  autosaveInterval: 4000
});

// 数据库初始化
function databaseInitialize() {
  // 获取或创建集合
  const users = db.getCollection('users') || db.addCollection('users', { unique: ['username'] });
  const diaries = db.getCollection('diaries') || db.addCollection('diaries');
  const yearPlans = db.getCollection('yearPlans') || db.addCollection('yearPlans', { unique: ['user_id', 'year'] });
  const monthPlans = db.getCollection('monthPlans') || db.addCollection('monthPlans', { unique: ['user_id', 'year', 'month'] });
  const attachments = db.getCollection('attachments') || db.addCollection('attachments');

  // 检查是否有默认用户，没有则创建
  const defaultUser = users.findOne({ username: 'admin' });
  if (!defaultUser) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    users.insert({
      username: 'admin',
      password: hashedPassword,
      created_at: new Date(),
      updated_at: new Date()
    });
    console.log('默认用户 admin 已创建');
  }

  console.log('数据库初始化完成');
}

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'attachments');
    const fs = require('fs');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// 用户认证
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  try {
    const users = db.getCollection('users');
    const user = users.findOne({ username: username });
    
    if (!user) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }
    
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) {
        return res.status(500).json({ success: false, error: '密码验证时出错' });
      }
      
      if (match) {
        res.json({ success: true, user: { id: user.$loki, username: user.username } });
      } else {
        res.status(401).json({ success: false, error: '用户名或密码错误' });
      }
    });
  } catch (error) {
    console.error('登录时出错:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 获取用户的所有日记
app.get('/api/diaries/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const diaries = db.getCollection('diaries');
    const userDiaries = diaries.find({ user_id: userId }).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json({ success: true, data: userDiaries });
  } catch (error) {
    console.error('查询日记时出错:', error);
    res.status(500).json({ success: false, error: '查询日记时出错' });
  }
});

// 保存日记
app.post('/api/diaries', (req, res) => {
  try {
    const { userId, diary } = req.body;
    const diaries = db.getCollection('diaries');
    
    // 检查是否已存在相同ID的日记
    const existingDiary = diaries.findOne({ id: diary.id });
    
    if (existingDiary) {
      // 更新现有日记
      diaries.update({
        ...existingDiary,
        ...diary,
        updated_at: new Date()
      });
    } else {
      // 插入新日记
      diaries.insert({
        ...diary,
        user_id: userId,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('保存日记时出错:', error);
    res.status(500).json({ success: false, error: '保存日记时出错' });
  }
});

// 获取年度计划
app.get('/api/year-plans/:userId/:year', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const year = parseInt(req.params.year);
    const yearPlans = db.getCollection('yearPlans');
    
    const plan = yearPlans.findOne({ user_id: userId, year: year });
    
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('查询年度计划时出错:', error);
    res.status(500).json({ success: false, error: '查询年度计划时出错' });
  }
});

// 保存年度计划
app.post('/api/year-plans', (req, res) => {
  try {
    const { userId, year, plan, summary } = req.body;
    const yearPlans = db.getCollection('yearPlans');
    
    // 检查是否已存在相同用户和年份的计划
    const existingPlan = yearPlans.findOne({ user_id: userId, year: year });
    
    if (existingPlan) {
      // 更新现有计划
      yearPlans.update({
        ...existingPlan,
        plan: plan,
        summary: summary,
        updated_at: new Date()
      });
    } else {
      // 插入新计划
      yearPlans.insert({
        user_id: userId,
        year: year,
        plan: plan,
        summary: summary,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('保存年度计划时出错:', error);
    res.status(500).json({ success: false, error: '保存年度计划时出错' });
  }
});

// 获取月度计划
app.get('/api/month-plans/:userId/:year/:month', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const monthPlans = db.getCollection('monthPlans');
    
    const plan = monthPlans.findOne({ user_id: userId, year: year, month: month });
    
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('查询月度计划时出错:', error);
    res.status(500).json({ success: false, error: '查询月度计划时出错' });
  }
});

// 保存月度计划
app.post('/api/month-plans', (req, res) => {
  try {
    const { userId, year, month, plan, summary } = req.body;
    const monthPlans = db.getCollection('monthPlans');
    
    // 检查是否已存在相同用户、年份和月份的计划
    const existingPlan = monthPlans.findOne({ user_id: userId, year: year, month: month });
    
    if (existingPlan) {
      // 更新现有计划
      monthPlans.update({
        ...existingPlan,
        plan: plan,
        summary: summary,
        updated_at: new Date()
      });
    } else {
      // 插入新计划
      monthPlans.insert({
        user_id: userId,
        year: year,
        month: month,
        plan: plan,
        summary: summary,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('保存月度计划时出错:', error);
    res.status(500).json({ success: false, error: '保存月度计划时出错' });
  }
});

// 上传附件
app.post('/api/attachments', upload.single('file'), (req, res) => {
  const { userId, diaryId } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ success: false, error: '没有选择文件' });
  }
  
  try {
    const attachments = db.getCollection('attachments');
    const attachment = attachments.insert({
      user_id: parseInt(userId),
      diary_id: diaryId,
      filename: req.file.filename,
      original_filename: req.file.originalname,
      file_size: req.file.size,
      file_type: req.file.mimetype,
      created_at: new Date()
    });
    
    res.json({ 
      success: true, 
      data: { 
        id: attachment.$loki, 
        filename: req.file.filename, 
        original_filename: req.file.originalname,
        file_size: req.file.size,
        file_type: req.file.mimetype
      } 
    });
  } catch (error) {
    console.error('保存附件时出错:', error);
    res.status(500).json({ success: false, error: '保存附件时出错' });
  }
});

// 获取日记的附件
app.get('/api/attachments/:userId/:diaryId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const diaryId = req.params.diaryId;
    const attachments = db.getCollection('attachments');
    
    const diaryAttachments = attachments.find({ user_id: userId, diary_id: diaryId });
    
    res.json({ success: true, data: diaryAttachments });
  } catch (error) {
    console.error('查询附件时出错:', error);
    res.status(500).json({ success: false, error: '查询附件时出错' });
  }
});

// 下载附件
app.get('/api/attachments/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'attachments', filename);
  
  res.download(filePath, (err) => {
    if (err) {
      res.status(404).json({ success: false, error: '文件未找到' });
    }
  });
});

// Excel导入功能（支持数据合并）
app.post('/api/import-excel', upload.single('file'), (req, res) => {
  const { userId } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ success: false, error: '没有选择文件' });
  }
  
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetNames = workbook.SheetNames;
    
    const importedData = {
      diaries: [],
      yearPlans: [],
      monthPlans: []
    };
    
    sheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      // 解析日记数据
      const diaries = [];
      const yearPlans = [];
      const monthPlans = [];
      
      jsonData.forEach(row => {
        // 识别不同类型的数据
        if (row['日期'] && !row['年度总计划'] && !row['月份']) {
          // 日记数据
          diaries.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            user_id: parseInt(userId),
            title: row['标题'] || '无标题',
            content: row['内容'] || '',
            plan: row['计划'] || '',
            summary: row['总结'] || '',
            category: row['分类'] || '',
            tags: row['标签'] || '',
            weather: row['天气'] || '',
            date: row['日期'] || new Date().toISOString().split('T')[0],
            lunar_date: row['农历日期'] || '',
            created_at: new Date(),
            updated_at: new Date()
          });
        } else if (row['年度总计划'] || row['全年总结']) {
          // 年度计划
          const year = parseInt(sheetName);
          yearPlans.push({
            user_id: parseInt(userId),
            year: year,
            plan: row['年度总计划'] || '',
            summary: row['全年总结'] || '',
            created_at: new Date(),
            updated_at: new Date()
          });
        } else if (row['月份']) {
          // 月度计划
          const year = parseInt(sheetName);
          const monthMap = {
            '一月': 1, '二月': 2, '三月': 3, '四月': 4,
            '五月': 5, '六月': 6, '七月': 7, '八月': 8,
            '九月': 9, '十月': 10, '十一月': 11, '十二月': 12
          };
          const month = monthMap[row['月份']];
          
          if (month) {
            monthPlans.push({
              user_id: parseInt(userId),
              year: year,
              month: month,
              plan: row['计划'] || '',
              summary: row['总结'] || '',
              created_at: new Date(),
              updated_at: new Date()
            });
          }
        }
      });
      
      importedData.diaries = [...importedData.diaries, ...diaries];
      importedData.yearPlans = [...importedData.yearPlans, ...yearPlans];
      importedData.monthPlans = [...importedData.monthPlans, ...monthPlans];
    });
    
    // 合并数据到数据库
    let count = 0;
    let updateCount = 0;
    let newCount = 0;
    
    // 合并年度计划
    const yearPlansCollection = db.getCollection('yearPlans');
    importedData.yearPlans.forEach(plan => {
      const existingPlan = yearPlansCollection.findOne({ user_id: plan.user_id, year: plan.year });
      if (existingPlan) {
        // 更新现有计划
        yearPlansCollection.update({
          ...existingPlan,
          plan: plan.plan,
          summary: plan.summary,
          updated_at: new Date()
        });
        updateCount++;
      } else {
        // 插入新计划
        yearPlansCollection.insert(plan);
        newCount++;
      }
      count++;
    });
    
    // 合并月度计划
    const monthPlansCollection = db.getCollection('monthPlans');
    importedData.monthPlans.forEach(plan => {
      const existingPlan = monthPlansCollection.findOne({ 
        user_id: plan.user_id, 
        year: plan.year, 
        month: plan.month 
      });
      
      if (existingPlan) {
        // 更新现有计划
        monthPlansCollection.update({
          ...existingPlan,
          plan: plan.plan,
          summary: plan.summary,
          updated_at: new Date()
        });
        updateCount++;
      } else {
        // 插入新计划
        monthPlansCollection.insert(plan);
        newCount++;
      }
      count++;
    });
    
    // 合并日记数据
    const diariesCollection = db.getCollection('diaries');
    importedData.diaries.forEach(diary => {
      // 检查是否已存在相同日期的日记
      const existingDiary = diariesCollection.findOne({ 
        user_id: diary.user_id, 
        date: diary.date 
      });
      
      if (existingDiary) {
        // 更新现有日记
        diariesCollection.update({
          ...existingDiary,
          ...diary,
          updated_at: new Date()
        });
        updateCount++;
      } else {
        // 插入新日记
        diariesCollection.insert(diary);
        newCount++;
      }
      count++;
    });
    
    // 删除临时文件
    const fs = require('fs');
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      message: `成功导入 ${count} 条记录，其中新增 ${newCount} 条，更新 ${updateCount} 条` 
    });
    
  } catch (error) {
    // 删除临时文件
    const fs = require('fs');
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('导入Excel文件时出错:', error);
    res.status(500).json({ success: false, error: '导入Excel文件时出错: ' + error.message });
  }
});

// 导出Excel功能
app.get('/api/export-excel/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const workbook = XLSX.utils.book_new();
    
    // 查询用户所有日记
    const diaries = db.getCollection('diaries').find({ user_id: userId });
    
    // 查询年度计划
    const yearPlans = db.getCollection('yearPlans').find({ user_id: userId });
    
    // 查询月度计划
    const monthPlans = db.getCollection('monthPlans').find({ user_id: userId });
    
    // 按年份分组数据
    const dataByYear = {};
    
    diaries.forEach(diary => {
      const year = new Date(diary.date).getFullYear();
      if (!dataByYear[year]) {
        dataByYear[year] = { diaries: [], yearPlan: null, monthPlans: [] };
      }
      dataByYear[year].diaries.push(diary);
    });
    
    yearPlans.forEach(plan => {
      if (!dataByYear[plan.year]) {
        dataByYear[plan.year] = { diaries: [], yearPlan: null, monthPlans: [] };
      }
      dataByYear[plan.year].yearPlan = plan;
    });
    
    monthPlans.forEach(plan => {
      if (!dataByYear[plan.year]) {
        dataByYear[plan.year] = { diaries: [], yearPlan: null, monthPlans: [] };
      }
      dataByYear[plan.year].monthPlans.push(plan);
    });
    
    // 生成Excel文件
    Object.keys(dataByYear).forEach(year => {
      const yearData = dataByYear[year];
      
      // 准备工作表数据
      const worksheetData = [];
      
      // 年度计划
      worksheetData.push({ '年度总计划': yearData.yearPlan ? yearData.yearPlan.plan : '无' });
      worksheetData.push({ '全年总结': yearData.yearPlan ? yearData.yearPlan.summary : '无' });
      worksheetData.push({}); // 空行
      
      // 月度计划
      const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                         '七月', '八月', '九月', '十月', '十一月', '十二月'];
      yearData.monthPlans.forEach(plan => {
        worksheetData.push({ 
          '月份': monthNames[plan.month - 1], 
          '计划': plan.plan, 
          '总结': plan.summary 
        });
      });
      
      worksheetData.push({}); // 空行
      
      // 日记记录
      yearData.diaries.forEach(diary => {
        worksheetData.push({
          '日期': diary.date,
          '农历日期': diary.lunar_date,
          '标题': diary.title,
          '内容': diary.content,
          '计划': diary.plan,
          '总结': diary.summary,
          '分类': diary.category,
          '标签': diary.tags,
          '天气': diary.weather
        });
      });
      
      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, year.toString());
    });
    
    // 保存Excel文件
    const outputPath = path.join(__dirname, 'temp', `diary_export_${userId}_${Date.now()}.xlsx`);
    const fs = require('fs');
    if (!fs.existsSync(path.join(__dirname, 'temp'))) {
      fs.mkdirSync(path.join(__dirname, 'temp'));
    }
    XLSX.writeFile(workbook, outputPath);
    
    // 发送文件给客户端
    res.download(outputPath, 'diary_export.xlsx', (err) => {
      if (err) {
        res.status(500).json({ success: false, error: '下载文件时出错' });
      }
      
      // 删除临时文件
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error('导出Excel文件时出错:', error);
    res.status(500).json({ success: false, error: '导出Excel文件时出错: ' + error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器正在运行在 http://localhost:${PORT}`);
});
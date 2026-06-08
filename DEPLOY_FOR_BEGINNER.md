# 极简部署清单

照着做就行。不要改代码。

## 第一步：创建 Supabase

1. 打开 https://supabase.com，登录后点 `New project`。
2. Project name 填 `battery-inquiry-ai`，Database Password 自己设一个密码。
3. 点 `Create new project`，等它创建完成。

## 第二步：复制 Supabase URL 和 anon key

1. 进入你的 Supabase 项目，点左下角 `Project Settings`。
2. 点 `API`，复制 `Project URL`。
3. 复制 `anon public` key，先临时放到记事本里。

## 第三步：执行 supabase.sql

1. 打开本项目里的 [supabase.sql](./supabase.sql)，复制全部内容。
2. 回到 Supabase，点左侧 `SQL Editor`，再点 `New query`。
3. 粘贴 SQL，点 `Run`。

## 第四步：创建 OpenAI API Key

1. 打开 https://platform.openai.com/api-keys 并登录。
2. 点 `Create new secret key`。
3. 复制生成的 Key，先临时放到记事本里。

如果你想先免费测试，可以用 Groq：

1. 打开 https://console.groq.com/keys 并登录。
2. 点 `Create API Key`。
3. 复制生成的 Key，先临时放到记事本里。

## 第五步：部署到 Vercel

1. 打开 https://vercel.com，登录后点 `Add New...`。
2. 点 `Project`，选择你的 GitHub 项目。
3. 点 `Import`，先停在填写环境变量的页面。

## 第六步：在 Vercel 填环境变量

如果用 OpenAI：

1. 添加 `AI_PROVIDER`，填写 `openai`。
2. 添加 `OPENAI_API_KEY`，粘贴 OpenAI Key。
3. 添加 `OPENAI_MODEL`，填写 `gpt-4.1-mini`。

如果用 Groq 免费测试：

1. 添加 `AI_PROVIDER`，填写 `groq`。
2. 添加 `GROQ_API_KEY`，粘贴 Groq Key。
3. 添加 `GROQ_MODEL`，填写 `llama-3.1-8b-instant`。

两个方案都必须再填：

1. 添加 `NEXT_PUBLIC_SUPABASE_URL`，粘贴 Supabase Project URL。
2. 添加 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，粘贴 Supabase anon public key。
3. 填完后点 `Deploy`。

## 第七步：打开网址测试

1. 部署成功后，点 Vercel 给你的网址。
2. 在网页里注册邮箱、登录、填写一个客户。
3. 点 `AI 生成跟进方案`，再点 `保存客户和 AI 分析`，最后打开 `客户列表` 看是否出现客户。

## 完成检查表

- [ ] 我已经创建 Supabase 项目
- [ ] 我已经复制 Supabase Project URL
- [ ] 我已经复制 Supabase anon public key
- [ ] 我已经执行 supabase.sql
- [ ] 我已经创建 OpenAI API Key
- [ ] 如果用 Groq，我已经创建 Groq API Key
- [ ] 我已经在 Vercel 导入项目
- [ ] 我已经在 Vercel 填写 `AI_PROVIDER`
- [ ] 如果用 OpenAI，我已经在 Vercel 填写 `OPENAI_API_KEY`
- [ ] 如果用 Groq，我已经在 Vercel 填写 `GROQ_API_KEY`
- [ ] 我已经在 Vercel 填写 `NEXT_PUBLIC_SUPABASE_URL`
- [ ] 我已经在 Vercel 填写 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] 我已经点了 Deploy
- [ ] 我已经打开线上网址测试成功

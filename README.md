# 储能电池询盘成交 AI 助手

这是一个可以部署到 Vercel 的网页 MVP。

你只需要按这个文件操作：

[DEPLOY_FOR_BEGINNER.md](./DEPLOY_FOR_BEGINNER.md)

## 你需要准备账号

1. Supabase：https://supabase.com
2. OpenAI：https://platform.openai.com/api-keys
3. Groq 免费测试：https://console.groq.com/keys
4. Vercel：https://vercel.com

## 你需要填写变量

默认用 OpenAI：

```text
AI_PROVIDER=openai
OPENAI_API_KEY
OPENAI_MODEL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

如果想先用 Groq 免费测试：

```text
AI_PROVIDER=groq
GROQ_API_KEY
GROQ_MODEL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## 你需要复制并执行这个 SQL 文件

[supabase.sql](./supabase.sql)

## 最短操作

1. 打开 [DEPLOY_FOR_BEGINNER.md](./DEPLOY_FOR_BEGINNER.md)。
2. 从第一步做到第七步。
3. 最后按检查表打勾。

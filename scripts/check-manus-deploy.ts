#!/usr/bin/env npx tsx
/**
 * Manus Deployment Status Check Script
 * سكربت للتحقق من حالة النشر عبر Manus API
 *
 * Usage:
 *   npx tsx scripts/check-manus-deploy.ts [task-id]
 *   npx tsx scripts/check-manus-deploy.ts --deploy
 *   npx tsx scripts/check-manus-deploy.ts --list
 */

import * as dotenv from 'dotenv';
dotenv.config();

const MANUS_API_KEY = process.env.MANUS_API_KEY;
const MANUS_API_URL = process.env.MANUS_API_URL || 'https://api.manus.ai/v1';

if (!MANUS_API_KEY) {
  console.error('❌ MANUS_API_KEY not found in .env');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${MANUS_API_KEY}`,
  'Content-Type': 'application/json',
};

interface ManusTask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  url?: string;
}

async function listTasks(): Promise<void> {
  console.log('\n📋 Fetching tasks from Manus...\n');

  try {
    const response = await fetch(`${MANUS_API_URL}/tasks`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Error: ${response.status} - ${error}`);
      return;
    }

    const tasks = await response.json() as ManusTask[];

    if (!tasks || tasks.length === 0) {
      console.log('📭 No tasks found');
      return;
    }

    console.log(`Found ${tasks.length} task(s):\n`);

    for (const task of tasks) {
      const statusEmoji = {
        pending: '⏳',
        running: '🔄',
        completed: '✅',
        failed: '❌',
      }[task.status] || '❓';

      console.log(`${statusEmoji} Task: ${task.id}`);
      console.log(`   Status: ${task.status}`);
      if (task.title) console.log(`   Title: ${task.title}`);
      if (task.url) console.log(`   URL: ${task.url}`);
      console.log(`   Created: ${task.createdAt}`);
      console.log(`   Updated: ${task.updatedAt}`);
      if (task.error) console.log(`   Error: ${task.error}`);
      console.log('');
    }
  } catch (error) {
    console.error('❌ Failed to fetch tasks:', error);
  }
}

async function getTaskStatus(taskId: string): Promise<void> {
  console.log(`\n🔍 Checking task status: ${taskId}\n`);

  try {
    const response = await fetch(`${MANUS_API_URL}/tasks/${taskId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Error: ${response.status} - ${error}`);
      return;
    }

    const task = await response.json() as ManusTask;

    const statusEmoji = {
      pending: '⏳',
      running: '🔄',
      completed: '✅',
      failed: '❌',
    }[task.status] || '❓';

    console.log(`${statusEmoji} Task Status Report`);
    console.log('═'.repeat(40));
    console.log(`ID:       ${task.id}`);
    console.log(`Status:   ${task.status}`);
    if (task.title) console.log(`Title:    ${task.title}`);
    if (task.url) console.log(`URL:      ${task.url}`);
    console.log(`Created:  ${task.createdAt}`);
    console.log(`Updated:  ${task.updatedAt}`);

    if (task.error) {
      console.log(`\n❌ Error:`);
      console.log(task.error);
    }

    if (task.result) {
      console.log(`\n📦 Result:`);
      console.log(JSON.stringify(task.result, null, 2));
    }
  } catch (error) {
    console.error('❌ Failed to get task status:', error);
  }
}

async function createDeployTask(): Promise<void> {
  console.log('\n🚀 Creating deployment task on Manus...\n');

  const payload = {
    type: 'deploy',
    project: process.env.MANUS_PROJECT_ID || 'erp-system',
    config: {
      build_command: 'pnpm build',
      start_command: 'pnpm start',
      env_vars: [
        'DATABASE_URL',
        'JWT_SECRET',
        'NODE_ENV',
        'RESEND_API_KEY',
      ],
    },
  };

  try {
    const response = await fetch(`${MANUS_API_URL}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Error: ${response.status} - ${error}`);
      return;
    }

    const task = await response.json() as ManusTask;

    console.log('✅ Deployment task created!');
    console.log('═'.repeat(40));
    console.log(`Task ID:  ${task.id}`);
    console.log(`Status:   ${task.status}`);
    console.log(`Created:  ${task.createdAt}`);
    console.log('');
    console.log('📝 To check status, run:');
    console.log(`   npx tsx scripts/check-manus-deploy.ts ${task.id}`);
  } catch (error) {
    console.error('❌ Failed to create deploy task:', error);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  console.log('═'.repeat(50));
  console.log('   Manus Deployment Status Checker');
  console.log('   نظام التحقق من حالة النشر عبر Manus');
  console.log('═'.repeat(50));
  console.log(`API URL: ${MANUS_API_URL}`);
  console.log(`API Key: ${MANUS_API_KEY?.substring(0, 10)}...`);

  if (args.length === 0 || args[0] === '--list') {
    await listTasks();
  } else if (args[0] === '--deploy') {
    await createDeployTask();
  } else {
    await getTaskStatus(args[0]);
  }
}

main().catch(console.error);

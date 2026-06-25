import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { listJsonFiles, readJsonFile } from '../../shared/fileStore';
import { commandIntentClassifier } from './CommandIntentClassifier';
import { commandContextBuilder } from './CommandContextBuilder';
import { toolRegistry } from './ToolRegistry';
import { workflowPlanner } from './WorkflowPlanner';
import { workflowExecutor } from './WorkflowExecutor';
import { clarifyingQuestionEngine } from './ClarifyingQuestionEngine';
import { commandResultFormatter } from './CommandResultFormatter';
import type { WorkflowPlan } from './WorkflowPlanner';

export const commandRouter = createElevationRouter();

commandRouter.post(
  '/api/command/interpret',
  asyncHandler(async (req, res) => {
    const { text, projectId, activeModule } = req.body as {
      text?: string;
      projectId?: string;
      activeModule?: string;
    };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }

    const intent = commandIntentClassifier.classify(text);
    const context = await commandContextBuilder.build({
      projectId,
      userId: req.user?.id,
      activeModule,
    });
    const questions = clarifyingQuestionEngine.generate(intent, Boolean(context.projectId));
    const formatted = commandResultFormatter.formatInterpretation(
      intent,
      questions.map((q) => q.question),
    );

    sendSuccess(res, { intent, context, questions, formatted });
  }),
);

commandRouter.post(
  '/api/command/plan',
  asyncHandler(async (req, res) => {
    const { text, projectId, activeModule } = req.body as {
      text?: string;
      projectId?: string;
      activeModule?: string;
    };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }

    const intent = commandIntentClassifier.classify(text);
    const context = await commandContextBuilder.build({
      projectId,
      userId: req.user?.id,
      activeModule,
    });
    const plan = workflowPlanner.plan(intent, context);
    await workflowPlanner.savePlan(plan);
    sendSuccess(res, commandResultFormatter.formatPlan(plan));
  }),
);

commandRouter.post(
  '/api/command/execute',
  asyncHandler(async (req, res) => {
    const { text, projectId, planId, activeModule } = req.body as {
      text?: string;
      projectId?: string;
      planId?: string;
      activeModule?: string;
    };

    let plan: WorkflowPlan;
    if (planId) {
      const saved = await readJsonFile<WorkflowPlan>('commands', `${planId}.json`);
      if (!saved) {
        sendError(res, new Error(`Plan not found: ${planId}`), 404);
        return;
      }
      plan = saved;
    } else {
      if (!text?.trim()) {
        sendError(res, new Error('text or planId is required'), 400);
        return;
      }
      const intent = commandIntentClassifier.classify(text);
      const context = await commandContextBuilder.build({
        projectId,
        userId: req.user?.id,
        activeModule,
      });
      plan = workflowPlanner.plan(intent, context);
      await workflowPlanner.savePlan(plan);
    }

    const execution = await workflowExecutor.execute(plan);
    sendSuccess(res, commandResultFormatter.formatExecution(plan, execution));
  }),
);

commandRouter.post(
  '/api/command/stream',
  asyncHandler(async (req, res) => {
    const { text, projectId } = req.body as { text?: string; projectId?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const intent = commandIntentClassifier.classify(text);
    const context = await commandContextBuilder.build({ projectId, userId: req.user?.id });
    const plan = workflowPlanner.plan(intent, context);

    const events = [
      { phase: 'interpret', data: intent },
      { phase: 'context', data: context },
      { phase: 'plan', data: { stepCount: plan.steps.length } },
      { phase: 'complete', data: commandResultFormatter.formatPlan(plan) },
    ];

    for (const event of events) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  }),
);

commandRouter.get(
  '/api/command/tools',
  asyncHandler(async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    sendSuccess(res, toolRegistry.listTools(category));
  }),
);

commandRouter.get(
  '/api/command/workflows/:projectId',
  asyncHandler(async (req, res) => {
    const projectId = param(req, 'projectId');
    const files = await listJsonFiles('commands');
    const workflows: WorkflowPlan[] = [];

    for (const file of files) {
      if (file.startsWith('exec-')) continue;
      const plan = await readJsonFile<WorkflowPlan>('commands', file);
      if (plan && plan.projectId === projectId) {
        workflows.push(plan);
      }
    }

    sendSuccess(res, workflows);
  }),
);

import {
  deleteById,
  findById,
  generateId,
  readCollection,
  upsert,
  writeCollection,
  type PlotPoint,
} from '../../shared';
import { NotFoundError } from './ProjectService';

const PLOT_POINTS = 'plot-points';

export class PlotService {
  async listPlotPoints(projectId: string): Promise<PlotPoint[]> {
    const plotPoints = await readCollection<PlotPoint>(PLOT_POINTS);
    return plotPoints
      .filter((plot) => plot.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  }

  async getPlotPoint(id: string): Promise<PlotPoint> {
    const plotPoint = await findById<PlotPoint>(PLOT_POINTS, id);
    if (!plotPoint) {
      throw new NotFoundError(`Plot point not found: ${id}`);
    }
    return plotPoint;
  }

  async createPlotPoint(data: Omit<PlotPoint, 'id'>): Promise<PlotPoint> {
    const plotPoint: PlotPoint = {
      ...data,
      id: generateId(),
    };

    await upsert(PLOT_POINTS, plotPoint);
    return plotPoint;
  }

  async updatePlotPoint(id: string, data: Partial<PlotPoint>): Promise<PlotPoint> {
    const existing = await this.getPlotPoint(id);
    const plotPoint: PlotPoint = {
      ...existing,
      ...data,
      id: existing.id,
      projectId: existing.projectId,
    };

    await upsert(PLOT_POINTS, plotPoint);
    return plotPoint;
  }

  async deletePlotPoint(id: string): Promise<void> {
    await this.getPlotPoint(id);
    await deleteById(PLOT_POINTS, id);
  }

  async reorderPlotPoints(projectId: string, orderedIds: string[]): Promise<void> {
    const plotPoints = await this.listPlotPoints(projectId);
    const plotMap = new Map(plotPoints.map((plot) => [plot.id, plot]));

    if (orderedIds.length !== plotPoints.length) {
      throw new Error('orderedIds must include all plot points for the project');
    }

    for (const plotId of orderedIds) {
      if (!plotMap.has(plotId)) {
        throw new Error(`Plot point ${plotId} does not belong to project ${projectId}`);
      }
    }

    const updated = orderedIds.map((plotId, index) => ({
      ...plotMap.get(plotId)!,
      order: index,
    }));

    const allPlotPoints = await readCollection<PlotPoint>(PLOT_POINTS);
    const updatedMap = new Map(updated.map((plot) => [plot.id, plot]));
    const nextPlotPoints = allPlotPoints.map(
      (plot) => updatedMap.get(plot.id) ?? plot,
    );
    await writeCollection(PLOT_POINTS, nextPlotPoints);
  }
}

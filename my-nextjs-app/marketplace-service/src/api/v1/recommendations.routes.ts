import { Router, Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';
import { RecommendationEngine } from '../../core/recommendations/RecommendationEngine';
import { MarketplaceConnectorEntry } from '../../types/marketplace.types';

const router = Router();
const recommendationEngine = new RecommendationEngine();

/**
 * GET /api/v1/recommendations
 * Provides a list of recommended marketplace connectors for a given tenant.
 * Query params: tenant_id (required), limit (optional, default 5)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.query.tenant_id as string;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;

  if (!tenantId) {
    return res.status(400).json({ error: 'tenant_id query parameter is required.' });
  }

  if (isNaN(limit) || limit <= 0) {
    return res.status(400).json({ error: 'limit query parameter must be a positive number.' });
  }

  try {
    logger.info({ tenantId, limit }, 'Fetching recommendations.');
    const recommendations: MarketplaceConnectorEntry[] = await recommendationEngine.getRecommendations(tenantId, limit);
    
    if (!recommendations) { // Should not happen if engine returns [] for no recs
        logger.warn({tenantId}, "Recommendation engine returned undefined or null, sending empty array.")
        return res.status(200).json([]);
    }

    res.status(200).json(recommendations);
  } catch (error: any) {
    logger.error({ tenantId, error: error.message, stack: error.stack }, 'Error generating recommendations');
    next(error); // Pass to global error handler
  }
});

export default router;
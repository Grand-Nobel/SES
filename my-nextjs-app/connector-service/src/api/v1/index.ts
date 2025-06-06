import { Router } from 'express';
import configurationsRoutes from './configurations.routes';
import connectorsRoutes from './connectors.routes';
// Import other v1 route modules here as they are created

const router = Router();

router.use('/configurations', configurationsRoutes);
router.use('/connectors', connectorsRoutes);
// router.use('/another-resource', anotherResourceRoutes);

export default router;
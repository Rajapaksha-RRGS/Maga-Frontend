import { Router } from 'express';
import {
  getAllEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  toggleEquipmentStatus,
  deleteEquipment,
  batchImportErpEquipment,
  getCorporateEquipmentCatalog,
  batchSyncCorporateEquipment,
} from '../controllers/equipmentController';

const router = Router();

router.get('/corporate-master', getCorporateEquipmentCatalog);
router.post('/corporate-master/batch', batchSyncCorporateEquipment);
router.get('/', getAllEquipment);
router.get('/:id', getEquipmentById);
router.post('/', createEquipment);
router.post('/batch-erp-import', batchImportErpEquipment);
router.put('/:id', updateEquipment);
router.patch('/:id/status', toggleEquipmentStatus);
router.delete('/:id', deleteEquipment);

export default router;


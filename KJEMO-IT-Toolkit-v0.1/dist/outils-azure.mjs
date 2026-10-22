/**
 * outils-azure.mjs — LOT 8 · KJEMO IT Toolkit
 * Agrégat des 24 assistants Azure et Microsoft Entra ID, dans l'ordre des
 * six familles : A (accès) · B (Entra ID) · C (machines virtuelles) ·
 * D (réseau) · E (stockage et protection) · F (surveillance et coûts).
 * Les familles A et B sont dans outils-azure-acces.mjs (7 assistants).
 */
import { toolsAzureAcces } from './outils-azure-acces.mjs';
import { toolsAzureVm } from './outils-azure-vm.mjs';
import { toolsAzureReseau } from './outils-azure-reseau.mjs';
import { toolsAzureStockage } from './outils-azure-stockage.mjs';
import { toolsAzureCout } from './outils-azure-cout.mjs';

export const toolsAzure = [
  ...toolsAzureAcces,
  ...toolsAzureVm,
  ...toolsAzureReseau,
  ...toolsAzureStockage,
  ...toolsAzureCout,
];

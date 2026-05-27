type TankAbbr = 'PLD' | 'WAR' | 'DRK' | 'GNB';
type HealerAbbr = 'WHM' | 'SCH' | 'AST' | 'SGE';
type MeleeDpsAbbr = 'DRG' | 'MNK' | 'NIN' | 'SAM' | 'RPR' | 'VPR';
type CasterDpsAbbr = 'BLM' | 'SMN' | 'RDM' | 'PCT';
type RangedDpsAbbr = 'BRD' | 'MCH' | 'DNC';
type DpsAbbr = MeleeDpsAbbr | CasterDpsAbbr | RangedDpsAbbr;

export type JobAbbreviation = TankAbbr | HealerAbbr | DpsAbbr;

export type JobRole = 'tank' | 'healer' | 'dps';

type TankSubRole = 'offtank' | 'maintank';
type HealerSubRole = 'regen' | 'shield';
type DpsSubRole = 'melee' | 'caster' | 'ranged';

export type JobSubRole = TankSubRole | HealerSubRole | DpsSubRole;
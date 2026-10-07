import type { PetState, Point } from '../components/cursor-pet/pet.types';
export function speedState(speed:number):PetState { return speed>.85?'RUN':speed>.08?'WALK':'IDLE'; }
export function clampPoint(point:Point, margin=36):Point { return {x:Math.max(margin,Math.min(innerWidth-margin,point.x)),y:Math.max(margin,Math.min(innerHeight-margin,point.y))}; }
export function distance(a:Point,b:Point):number { return Math.hypot(a.x-b.x,a.y-b.y); }

import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

export class UUIDHelper {
  static generate(): string {
    return uuidv4();
  }

  static validate(uuid: string): boolean {
    return uuidValidate(uuid);
  }
}

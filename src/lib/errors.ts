// Erreurs d'autorisation communes, sans dépendance (importables par le client
// Prisma lui-même, sans import circulaire).

export class ForbiddenError extends Error {
  constructor(message = "Action non autorisée pour ce rôle.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export const READ_ONLY_MESSAGE =
  "Mode consultation : vous voyez l'écran de cette fonction, mais aucune modification, validation, signature ni export n'est possible. Revenez à votre propre fonction pour agir.";

/** Écriture refusée pendant une bascule en consultation (informaticien, secrétaires de l'IPP). */
export class ReadOnlyModeError extends ForbiddenError {
  constructor() {
    super(READ_ONLY_MESSAGE);
    this.name = "ReadOnlyModeError";
  }
}

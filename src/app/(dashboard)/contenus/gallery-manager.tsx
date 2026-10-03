"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { CONTENT_LIMITS } from "@/lib/content-meta";
import { deleteGalleryPhotoAction, updateGalleryCaptionAction, uploadGalleryPhotoAction } from "./actions";
import { downscaleImage } from "./downscale-image";

export type GalleryItem = { id: string; alt: string | null };

/**
 * Photos d'album d'un contenu enregistré : envoi de plusieurs photos (une
 * requête par photo), légende modifiable, suppression. Indépendant du
 * formulaire principal : chaque action est enregistrée aussitôt.
 */
export function GalleryManager({ contentId, initial }: { contentId: string; initial: GalleryItem[] }) {
  const [photos, setPhotos] = useState<GalleryItem[]>(initial);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = CONTENT_LIMITS.galleryPerContent - photos.length;

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, Math.max(0, remaining));
    const skipped = files.length - list.length;
    setErrors(skipped > 0 ? [`${skipped} photo(s) ignorée(s) : ${CONTENT_LIMITS.galleryPerContent} photos maximum par album.`] : []);
    startTransition(async () => {
      setProgress({ done: 0, total: list.length });
      for (const [i, file] of list.entries()) {
        const fd = new FormData();
        fd.set("photo", await downscaleImage(file));
        const res = await uploadGalleryPhotoAction(contentId, fd);
        if (res.photo) setPhotos((p) => [...p, res.photo!]);
        else if (res.error) setErrors((e) => [...e, res.error!]);
        setProgress({ done: i + 1, total: list.length });
      }
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  const onCaption = (id: string, alt: string) => {
    const previous = photos.find((p) => p.id === id)?.alt ?? null;
    if ((previous ?? "") === alt.trim()) return;
    setPhotos((p) => p.map((x) => (x.id === id ? { ...x, alt: alt.trim() || null } : x)));
    startTransition(async () => {
      const res = await updateGalleryCaptionAction(contentId, id, alt);
      if (res.error) setErrors([res.error]);
    });
  };

  const onDelete = (id: string) => {
    if (!window.confirm("Retirer cette photo de l'album ?")) return;
    startTransition(async () => {
      const res = await deleteGalleryPhotoAction(contentId, id);
      if (res.error) setErrors([res.error]);
      else setPhotos((p) => p.filter((x) => x.id !== id));
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Galerie photos</h2>
          <p className="text-xs text-gray-500">
            {photos.length}/{CONTENT_LIMITS.galleryPerContent} photos. Elles s&apos;affichent sous le texte, en grand au clic.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || remaining <= 0}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {progress ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ImagePlus size={16} aria-hidden />}
          {progress ? `Envoi ${progress.done}/${progress.total}…` : "Ajouter des photos"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {errors.length > 0 && (
        <ul className="space-y-0.5 text-xs text-red-600">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- image servie par /medias */}
                <img src={`/medias/${p.id}`} alt={p.alt ?? ""} loading="lazy" className="aspect-[4/3] w-full bg-gray-100 object-cover" />
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  disabled={busy}
                  aria-label="Retirer la photo"
                  title="Retirer la photo"
                  className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-600 shadow hover:bg-white"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
              <input
                defaultValue={p.alt ?? ""}
                onBlur={(e) => onCaption(p.id, e.target.value)}
                maxLength={CONTENT_LIMITS.alt}
                placeholder="Légende"
                aria-label="Légende de la photo"
                className="w-full border-0 border-t border-gray-100 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-100"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

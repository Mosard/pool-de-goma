"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Save,
} from "lucide-react";
import { Alert, Button, Card, FieldError, Input, Label, Select, Textarea } from "@/components/ui";
import { renderContentBody } from "@/lib/content-markup";
import { CONTENT_KIND_LABELS, CONTENT_KINDS, CONTENT_LIMITS, type ContentKindKey } from "@/lib/content-meta";
import { saveContentAction, uploadInlineImageAction, type ContentFormState } from "./actions";

export type EditorContent = {
  id: string;
  kind: ContentKindKey;
  title: string;
  summary: string;
  body: string;
  cover: { id: string; alt: string | null } | null;
  attachment: { id: string; fileName: string | null } | null;
};

const initialState: ContentFormState = {};

/**
 * Réduit une photo dans le navigateur (2000 px, JPEG) avant l'envoi : les
 * photos de téléphone dépassent souvent la limite d'envoi. Le serveur
 * revérifie et recompresse de toute façon.
 */
async function downscaleImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

const fileInputClass =
  "block w-full text-xs text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium";

export function ContentEditor({ content }: { content: EditorContent | null }) {
  const [state, formAction, pending] = useActionState(saveContentAction.bind(null, content?.id ?? null), initialState);
  const [kind, setKind] = useState<ContentKindKey>(content?.kind ?? "ACTUALITE");
  const [summary, setSummary] = useState(content?.summary ?? "");
  const [body, setBody] = useState(content?.body ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(content?.cover ? `/medias/${content.cover.id}` : null);

  // Image insérée dans le texte.
  const imageRef = useRef<HTMLInputElement>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();

  const insert = (before: string, after = "", placeholder = "") => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = body.slice(s, e) || placeholder;
    setBody(body.slice(0, s) + before + selected + after + body.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };

  /** Bloc séparé dont chaque ligne reçoit un préfixe (intertitre, liste, citation). */
  const insertBlock = (text: string, at: number, end = at) => {
    const beforeText = body.slice(0, at);
    const lead = beforeText === "" || beforeText.endsWith("\n\n") ? "" : beforeText.endsWith("\n") ? "\n" : "\n\n";
    setBody(beforeText + lead + text + "\n\n" + body.slice(end).replace(/^\n+/, ""));
    requestAnimationFrame(() => bodyRef.current?.focus());
  };

  const prefixLines = (prefix: (i: number) => string, placeholder: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = body.slice(s, e) || placeholder;
    const block = selected
      .split("\n")
      .map((l, i) => prefix(i) + l.replace(/^(#{2,3}\s+|-\s+|\d+\.\s+|>\s?)/, ""))
      .join("\n");
    insertBlock(block, s, e);
  };

  const addLink = () => {
    const url = window.prompt("Adresse du lien (https://… ou /page du site)");
    if (!url) return;
    insert("[", `](${url.trim()})`, "texte du lien");
  };

  const onInlineImage = (file: File | undefined) => {
    if (!file || !content) return;
    setImageError(null);
    const at = bodyRef.current?.selectionEnd ?? body.length;
    startUpload(async () => {
      const fd = new FormData();
      fd.set("image", await downscaleImage(file));
      fd.set("alt", imageAlt);
      const res = await uploadInlineImageAction(content.id, {}, fd);
      if (res.formError || !res.snippet) {
        setImageError(res.formError ?? "Envoi impossible.");
        return;
      }
      insertBlock(res.snippet, at);
      setImageAlt("");
      if (imageRef.current) imageRef.current.value = "";
    });
  };

  const onCover = async (file: File | undefined) => {
    if (!file || !coverRef.current) return;
    const small = await downscaleImage(file);
    const dt = new DataTransfer();
    dt.items.add(small);
    coverRef.current.files = dt.files;
    setCoverPreview(URL.createObjectURL(small));
  };

  const tool = "flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900";

  return (
    <form action={formAction} className="space-y-6">
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <div>
            <Label htmlFor="kind">Type</Label>
            <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as ContentKindKey)}>
              {CONTENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CONTENT_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
            <FieldError message={state.errors?.kind} />
          </div>
          <div>
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" defaultValue={content?.title} required maxLength={CONTENT_LIMITS.title} />
            <FieldError message={state.errors?.title} />
          </div>
        </div>
        <div>
          <Label htmlFor="summary">Résumé (affiché sur les cartes et dans les moteurs de recherche)</Label>
          <Textarea
            id="summary"
            name="summary"
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={CONTENT_LIMITS.summary}
            required
          />
          <div className="mt-1 flex justify-between">
            <FieldError message={state.errors?.summary} />
            <span className="ml-auto text-xs text-gray-400">
              {summary.length}/{CONTENT_LIMITS.summary}
            </span>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Texte</h2>
          <div className="inline-flex rounded-full bg-gray-100 p-1 text-xs font-medium lg:hidden">
            {(["write", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={clsx("rounded-full px-3 py-1", tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}
              >
                {t === "write" ? "Écrire" : "Aperçu"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className={clsx(tab === "preview" && "hidden lg:block")}>
            <div className="flex flex-wrap items-center gap-0.5 rounded-t-xl border border-b-0 border-gray-200 bg-gray-50 px-1.5 py-1">
              <button type="button" className={tool} title="Gras" aria-label="Gras" onClick={() => insert("**", "**", "texte en gras")}>
                <Bold size={16} />
              </button>
              <button type="button" className={tool} title="Italique" aria-label="Italique" onClick={() => insert("*", "*", "texte en italique")}>
                <Italic size={16} />
              </button>
              <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
              <button type="button" className={tool} title="Intertitre" aria-label="Intertitre" onClick={() => prefixLines(() => "## ", "Intertitre")}>
                <Heading2 size={16} />
              </button>
              <button type="button" className={tool} title="Sous-intertitre" aria-label="Sous-intertitre" onClick={() => prefixLines(() => "### ", "Sous-intertitre")}>
                <Heading3 size={16} />
              </button>
              <button type="button" className={tool} title="Liste" aria-label="Liste à puces" onClick={() => prefixLines(() => "- ", "Élément")}>
                <List size={16} />
              </button>
              <button type="button" className={tool} title="Liste numérotée" aria-label="Liste numérotée" onClick={() => prefixLines((i) => `${i + 1}. `, "Élément")}>
                <ListOrdered size={16} />
              </button>
              <button type="button" className={tool} title="Citation" aria-label="Citation" onClick={() => prefixLines(() => "> ", "Citation")}>
                <Quote size={16} />
              </button>
              <button type="button" className={tool} title="Lien" aria-label="Lien" onClick={addLink}>
                <Link2 size={16} />
              </button>
              <button
                type="button"
                className={clsx(tool, !content && "cursor-not-allowed opacity-40")}
                title={content ? "Insérer une image" : "Enregistrez d'abord le brouillon pour insérer des images"}
                aria-label="Insérer une image"
                disabled={!content || uploading}
                onClick={() => imageRef.current?.click()}
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              </button>
            </div>
            <textarea
              ref={bodyRef}
              name="body"
              rows={18}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={CONTENT_LIMITS.body}
              aria-label="Texte du contenu"
              className="w-full rounded-b-xl border border-gray-200 px-3.5 py-2.5 font-mono text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <FieldError message={state.errors?.body} />
            {content && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <label htmlFor="inline-alt">Légende de la prochaine image :</label>
                <input
                  id="inline-alt"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  maxLength={CONTENT_LIMITS.alt}
                  placeholder="Ex. Visite de l'IPP à l'EP Goma"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs"
                />
                <input
                  ref={imageRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => onInlineImage(e.target.files?.[0])}
                />
              </div>
            )}
            {imageError && <p className="mt-1 text-xs text-red-600">{imageError}</p>}
          </div>

          <div
            className={clsx(
              "min-h-[12rem] rounded-xl border border-gray-200 bg-white px-5 py-2 text-[15px] text-gray-700",
              tab === "write" && "hidden lg:block"
            )}
          >
            <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Aperçu</p>
            {body.trim() ? renderContentBody(body) : <p className="my-4 text-sm text-gray-400">Le texte apparaîtra ici.</p>}
          </div>
        </div>
      </Card>

      <Card className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Image de couverture</h2>
          {coverPreview && (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou /medias
            <img src={coverPreview} alt="" className="aspect-[16/9] w-full rounded-xl bg-gray-100 object-cover" />
          )}
          <input
            ref={coverRef}
            type="file"
            name="cover"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => onCover(e.target.files?.[0])}
            className={fileInputClass}
          />
          <FieldError message={state.errors?.cover} />
          <Input
            name="coverAlt"
            defaultValue={content?.cover?.alt ?? ""}
            placeholder="Description de l'image (accessibilité)"
            maxLength={CONTENT_LIMITS.alt}
          />
          {content?.cover && (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" name="removeCover" /> Retirer l&apos;image de couverture
            </label>
          )}
        </div>
        {kind === "COMMUNIQUE" && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">PDF joint (facultatif)</h2>
            {content?.attachment && (
              <a href={`/medias/${content.attachment.id}`} target="_blank" className="block text-xs font-medium text-blue-700 hover:underline">
                {content.attachment.fileName ?? "Document joint"}
              </a>
            )}
            <input type="file" name="attachment" accept="application/pdf" className={fileInputClass} />
            <p className="text-xs text-gray-400">4 Mo maximum.</p>
            <FieldError message={state.errors?.attachment} />
            {content?.attachment && (
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" name="removeAttachment" /> Retirer le PDF joint
              </label>
            )}
          </div>
        )}
      </Card>

      {state.formError && <Alert variant="error">{state.formError}</Alert>}
      {state.success && <Alert variant="success">Brouillon enregistré.</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
          {pending ? "Enregistrement…" : "Enregistrer le brouillon"}
        </Button>
        {!content && (
          <p className="text-xs text-gray-500">
            Après ce premier enregistrement, vous pourrez insérer des images et soumettre le contenu.
          </p>
        )}
      </div>
    </form>
  );
}

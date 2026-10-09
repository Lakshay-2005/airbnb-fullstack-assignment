"use client";

import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { useToast } from "@/components/ui/Toast";
import { useFetch } from "@/hooks/useFetch";
import {
  ApiError,
  errorMessage,
  hostApi,
  listingsApi,
  type ListingDetail,
  type ListingInput,
  type ListingStatus,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { amenityIcon } from "@/lib/icons";

const SAMPLE_PHOTOS = [
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1600&q=80",
];

interface FormState {
  title: string;
  description: string;
  location: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  property_type: string;
  category: string;
  guests_capacity: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  nightly_price: string;
  cleaning_fee: string;
  service_fee: string;
  status: ListingStatus;
  amenities: string[];
  images: string[];
}

const EMPTY: FormState = {
  title: "",
  description: "",
  location: "",
  city: "",
  country: "",
  latitude: "",
  longitude: "",
  property_type: "Villa",
  category: "design",
  guests_capacity: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  nightly_price: "",
  cleaning_fee: "0",
  service_fee: "0",
  status: "ACTIVE",
  amenities: ["Wifi"],
  images: [""],
};

const fromListing = (l: ListingDetail): FormState => ({
  title: l.title,
  description: l.description,
  location: l.location,
  city: l.city,
  country: l.country,
  latitude: l.latitude === null ? "" : String(l.latitude),
  longitude: l.longitude === null ? "" : String(l.longitude),
  property_type: l.property_type,
  category: l.category,
  guests_capacity: l.guests_capacity,
  bedrooms: l.bedrooms,
  beds: l.beds,
  bathrooms: l.bathrooms,
  nightly_price: String(l.nightly_price),
  cleaning_fee: String(l.cleaning_fee),
  service_fee: String(l.service_fee),
  status: l.status,
  amenities: l.amenities,
  images: l.images.length ? l.images : [""],
});

type Errors = Partial<Record<string, string>>;

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (form.title.trim().length < 5) errors.title = "Give your listing a title of at least 5 characters.";
  if (form.description.trim().length < 20) errors.description = "Describe your place in at least 20 characters.";
  if (form.location.trim().length < 2) errors.location = "Add the address or neighbourhood.";
  if (form.city.trim().length < 2) errors.city = "City is required.";
  if (form.country.trim().length < 2) errors.country = "Country is required.";
  const price = Number(form.nightly_price);
  if (!form.nightly_price || !Number.isFinite(price) || price < 10) errors.nightly_price = "Nightly price must be at least $10.";
  for (const key of ["cleaning_fee", "service_fee"] as const) {
    const value = Number(form[key]);
    if (!Number.isFinite(value) || value < 0) errors[key] = "Enter 0 or more.";
  }
  const lat = form.latitude.trim();
  const lng = form.longitude.trim();
  if ((lat && !lng) || (!lat && lng)) errors.latitude = "Provide both latitude and longitude, or neither.";
  else if (lat && (Math.abs(Number(lat)) > 90 || Number.isNaN(Number(lat)))) errors.latitude = "Latitude must be between -90 and 90.";
  else if (lng && (Math.abs(Number(lng)) > 180 || Number.isNaN(Number(lng)))) errors.longitude = "Longitude must be between -180 and 180.";
  const urls = form.images.map((u) => u.trim()).filter(Boolean);
  if (urls.length === 0) errors.images = "Add at least one photo.";
  else if (urls.some((u) => !/^https?:\/\//i.test(u))) errors.images = "Photo links must start with http:// or https://";
  return errors;
}

const toInput = (form: FormState): ListingInput => ({
  title: form.title.trim(),
  description: form.description.trim(),
  location: form.location.trim(),
  city: form.city.trim(),
  country: form.country.trim(),
  latitude: form.latitude.trim() ? Number(form.latitude) : null,
  longitude: form.longitude.trim() ? Number(form.longitude) : null,
  property_type: form.property_type,
  category: form.category,
  guests_capacity: form.guests_capacity,
  bedrooms: form.bedrooms,
  beds: form.beds,
  bathrooms: form.bathrooms,
  nightly_price: Number(form.nightly_price),
  cleaning_fee: Number(form.cleaning_fee || 0),
  service_fee: Number(form.service_fee || 0),
  status: form.status,
  amenities: form.amenities,
  images: form.images.map((u) => u.trim()).filter(Boolean),
});

export function ListingForm({ listing }: { listing?: ListingDetail }) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(listing);
  const meta = useFetch((signal) => listingsApi.meta({ signal }), []);
  const [form, setForm] = useState<FormState>(() => (listing ? fromListing(listing) : EMPTY));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customAmenity, setCustomAmenity] = useState("");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setImage = (index: number, value: string) => set("images", form.images.map((u, i) => (i === index ? value : u)));
  const moveImage = (index: number, delta: number) => {
    const next = [...form.images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set("images", next);
  };
  const toggleAmenity = (name: string) =>
    set("amenities", form.amenities.includes(name) ? form.amenities.filter((a) => a !== name) : [...form.amenities, name]);

  const addCustomAmenity = () => {
    const name = customAmenity.trim();
    if (name && !form.amenities.some((a) => a.toLowerCase() === name.toLowerCase())) set("amenities", [...form.amenities, name]);
    setCustomAmenity("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError("Please fix the highlighted fields.");
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }
    setSaving(true);
    try {
      const saved = editing ? await hostApi.update(listing!.id, toInput(form)) : await hostApi.create(toInput(form));
      toast.success(editing ? "Listing updated." : "Listing published! Here's how guests will see it.");
      router.push(editing ? "/host" : `/listings/${saved.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.length) {
        const mapped: Errors = {};
        for (const { field, message } of error.fieldErrors) mapped[field.split(".")[0]] = message;
        setErrors(mapped);
      }
      setFormError(errorMessage(error));
      setSaving(false);
    }
  };

  const allAmenities = [...new Set([...(meta.data?.amenities ?? []), ...form.amenities])].sort();

  return (
    <form onSubmit={submit} noValidate className="container-narrow max-w-3xl pb-32 pt-8">
      <h1 className="text-[28px] font-semibold md:text-[32px]">{editing ? "Edit listing" : "Create a new listing"}</h1>
      <p className="mt-1 text-muted">{editing ? "Changes are visible to guests as soon as you save." : "Tell guests about your place. You can edit everything later."}</p>

      {formError && <Alert tone="error" className="mt-6">{formError}</Alert>}

      <Section title="The basics">
        <Field label="Title" htmlFor="title" error={errors.title}>
          <Input id="title" value={form.title} maxLength={160} invalid={!!errors.title} onChange={(e) => set("title", e.target.value)} placeholder="Sunny loft near the old town" />
        </Field>
        <Field label="Description" htmlFor="description" error={errors.description} hint={`${form.description.length}/5000`}>
          <Textarea id="description" value={form.description} maxLength={5000} invalid={!!errors.description} onChange={(e) => set("description", e.target.value)} placeholder="What makes your place special?" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Property type" htmlFor="property_type">
            <Select id="property_type" value={form.property_type} onChange={(e) => set("property_type", e.target.value)}>
              {[...new Set([...(meta.data?.property_types ?? []), form.property_type])].map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Category" htmlFor="category" hint="Where guests will find you in the category bar">
            <Select id="category" value={form.category} onChange={(e) => set("category", e.target.value)}>
              {(meta.data?.categories ?? [{ id: form.category, label: form.category }]).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          {editing && (
            <Field label="Visibility" htmlFor="status" hint="Paused listings are hidden from search">
              <Select id="status" value={form.status} onChange={(e) => set("status", e.target.value as ListingStatus)}>
                <option value="ACTIVE">Active — visible to guests</option>
                <option value="PAUSED">Paused — hidden from search</option>
              </Select>
            </Field>
          )}
        </div>
      </Section>

      <Section title="Location">
        <Field label="Address or neighbourhood" htmlFor="location" error={errors.location}>
          <Input id="location" value={form.location} invalid={!!errors.location} onChange={(e) => set("location", e.target.value)} placeholder="Anjuna, Goa, India" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City" htmlFor="city" error={errors.city}>
            <Input id="city" value={form.city} invalid={!!errors.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="Country" htmlFor="country" error={errors.country}>
            <Input id="country" value={form.country} invalid={!!errors.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
          <Field label="Latitude (optional)" htmlFor="latitude" error={errors.latitude} hint="Shows your place on the map. Defaults to the city centre when blank.">
            <Input id="latitude" inputMode="decimal" value={form.latitude} invalid={!!errors.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="15.5736" />
          </Field>
          <Field label="Longitude (optional)" htmlFor="longitude" error={errors.longitude}>
            <Input id="longitude" inputMode="decimal" value={form.longitude} invalid={!!errors.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="73.7414" />
          </Field>
        </div>
      </Section>

      <Section title="Space">
        <div className="divide-y divide-line rounded-2xl border border-line">
          {([["guests_capacity", "Guests", 1, 32], ["bedrooms", "Bedrooms", 0, 20], ["beds", "Beds", 1, 40], ["bathrooms", "Bathrooms", 1, 20]] as const).map(([key, label, min, max]) => (
            <div key={key} className="flex items-center justify-between px-5 py-4">
              <span className="font-medium">{label}</span>
              <Counter label={label.toLowerCase()} value={form[key]} min={min} max={max} onChange={(v) => set(key, v)} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Pricing" description="All amounts are in US dollars. Fees are charged once per stay.">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Nightly price" htmlFor="nightly_price" error={errors.nightly_price}>
            <Input id="nightly_price" type="number" min={10} inputMode="numeric" value={form.nightly_price} invalid={!!errors.nightly_price} onChange={(e) => set("nightly_price", e.target.value)} placeholder="150" />
          </Field>
          <Field label="Cleaning fee" htmlFor="cleaning_fee" error={errors.cleaning_fee}>
            <Input id="cleaning_fee" type="number" min={0} inputMode="numeric" value={form.cleaning_fee} invalid={!!errors.cleaning_fee} onChange={(e) => set("cleaning_fee", e.target.value)} />
          </Field>
          <Field label="Service fee" htmlFor="service_fee" error={errors.service_fee}>
            <Input id="service_fee" type="number" min={0} inputMode="numeric" value={form.service_fee} invalid={!!errors.service_fee} onChange={(e) => set("service_fee", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Amenities">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {allAmenities.map((name) => {
            const Icon = amenityIcon(name);
            const selected = form.amenities.includes(name);
            return (
              <label key={name} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm transition hover:border-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2", selected ? "border-ink bg-surface font-medium" : "border-line")}>
                <input type="checkbox" className="sr-only" checked={selected} onChange={() => toggleAmenity(name)} />
                <Icon className="size-4 shrink-0" /> {name}
              </label>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input aria-label="Add a custom amenity" value={customAmenity} onChange={(e) => setCustomAmenity(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomAmenity(); } }} placeholder="Something else, e.g. Hammock" />
          <Button variant="secondary" size="lg" onClick={addCustomAmenity} disabled={!customAmenity.trim()} icon={<Plus className="size-4" />}>Add</Button>
        </div>
      </Section>

      <Section title="Photos" description="Paste image links. The first photo is your cover and appears on search cards.">
        <div className="space-y-3">
          {form.images.map((url, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">
                {url.trim() ? <Img src={url.trim()} alt={`Preview ${index + 1}`} width={160} className="size-full" /> : <ImagePlus className="size-5 text-faint" />}
              </div>
              <Input id={index === 0 ? "images" : undefined} aria-label={`Photo ${index + 1} URL`} value={url} onChange={(e) => setImage(index, e.target.value)} placeholder="https://…" invalid={index === 0 && !!errors.images} />
              <div className="flex shrink-0">
                <button type="button" aria-label="Move photo up" disabled={index === 0} onClick={() => moveImage(index, -1)} className="rounded-lg p-2 hover:bg-surface disabled:opacity-30"><ArrowUp className="size-4" /></button>
                <button type="button" aria-label="Move photo down" disabled={index === form.images.length - 1} onClick={() => moveImage(index, 1)} className="rounded-lg p-2 hover:bg-surface disabled:opacity-30"><ArrowDown className="size-4" /></button>
                <button type="button" aria-label="Remove photo" onClick={() => set("images", form.images.length > 1 ? form.images.filter((_, i) => i !== index) : [""])} className="rounded-lg p-2 text-danger hover:bg-danger-soft"><Trash2 className="size-4" /></button>
              </div>
            </div>
          ))}
        </div>
        {errors.images && <p role="alert" className="text-sm text-danger">{errors.images}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={form.images.length >= 12} onClick={() => set("images", [...form.images, ""])} icon={<Plus className="size-4" />}>Add another photo</Button>
          <Button variant="ghost" onClick={() => set("images", SAMPLE_PHOTOS)} icon={<ImagePlus className="size-4" />}>Use sample photos</Button>
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur">
        <div className="container-narrow flex max-w-3xl items-center justify-between gap-3 py-3">
          <ButtonLink href="/host" variant="ghost" icon={<X className="size-4" />}>Cancel</ButtonLink>
          <Button type="submit" size="lg" loading={saving}>{editing ? "Save changes" : "Publish listing"}</Button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-b border-line py-8 last:border-b-0">
      <h2 className="text-[22px] font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

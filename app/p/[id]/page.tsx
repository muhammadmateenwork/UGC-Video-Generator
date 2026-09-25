import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Studio } from "@/components/studio/Studio";
import { getOwnerId } from "@/lib/owner";
import { loadProject } from "@/lib/pipeline";
import { uuidSchema } from "@/lib/http";

export const metadata: Metadata = { title: "Studio" };

export default async function StudioPage(props: PageProps<"/p/[id]">) {
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const project = await loadProject(id, await getOwnerId());
  if (!project) notFound();
  // Someone else's project: show the public page if there's a video, otherwise nothing.
  if (!project.isOwner) {
    if (project.videoUrl) redirect(`/v/${id}`);
    notFound();
  }
  return <Studio initial={project} />;
}

import { type ChangeEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileArchive, FolderUp, GitBranch, Globe, Loader2, Plus, ShieldAlert } from "lucide-react";
import { Navigate, useNavigate, useOutletContext } from "react-router-dom";
import { Badge, Button, Input } from "@ai-archaeologist/ui";
import { RepositoryRadarCard } from "../components/RepositoryRadarCard.js";
import type { AuthResponse } from "../api/schemas.js";
import {
  createFolderRepository,
  createGithubRepository,
  createWebsiteRepository,
  createZipRepository,
  listRepositories,
} from "../api/repositories.js";

type ShellContext = {
  me?: Omit<AuthResponse, "organization">;
};

export function RepositoriesPage(): React.JSX.Element {
  const { me } = useOutletContext<ShellContext>();
  const organizationId = me?.memberships.at(0)?.organizationId;
  const navigate = useNavigate();
  const [githubUrl, setGithubUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [folderFiles, setFolderFiles] = useState<FileList | null>(null);
  const queryClient = useQueryClient();

  const repositoriesQuery = useQuery({
    enabled: Boolean(organizationId),
    queryFn: () => listRepositories(organizationId ?? ""),
    queryKey: ["repositories", organizationId],
  });

  const githubMutation = useMutation({
    mutationFn: () => createGithubRepository({ organizationId: organizationId ?? "", url: githubUrl }),
    onSuccess: async (result) => {
      setGithubUrl("");
      await queryClient.invalidateQueries({ queryKey: ["repositories", organizationId] });
      navigate(`/repositories/${result.repository.id}`);
    },
  });

  const websiteMutation = useMutation({
    mutationFn: () =>
      createWebsiteRepository({ organizationId: organizationId ?? "", url: websiteUrl }),
    onSuccess: async (result) => {
      setWebsiteUrl("");
      await queryClient.invalidateQueries({ queryKey: ["repositories", organizationId] });
      navigate(`/repositories/${result.repository.id}`);
    },
  });

  const zipMutation = useMutation({
    mutationFn: (archive: File) =>
      createZipRepository({ archive, organizationId: organizationId ?? "" }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["repositories", organizationId] });
      navigate(`/repositories/${result.repository.id}`);
    },
  });

  const folderMutation = useMutation({
    mutationFn: () =>
      createFolderRepository({
        displayName:
          Array.from(folderFiles ?? [])
            .at(0)
            ?.webkitRelativePath?.split("/")
            .at(0) || "folder-upload",
        files: Array.from(folderFiles ?? []),
        organizationId: organizationId ?? "",
      }),
    onSuccess: async (result) => {
      setFolderFiles(null);
      await queryClient.invalidateQueries({ queryKey: ["repositories", organizationId] });
      navigate(`/repositories/${result.repository.id}`);
    },
  });

  const errorMessage = useMemo(() => {
    const error =
      githubMutation.error ??
      websiteMutation.error ??
      zipMutation.error ??
      folderMutation.error ??
      repositoriesQuery.error;
    return error instanceof Error ? error.message : undefined;
  }, [folderMutation.error, githubMutation.error, repositoriesQuery.error, websiteMutation.error, zipMutation.error]);

  if (!me?.user) {
    return <Navigate to="/login" replace />;
  }

  function handleZipChange(event: ChangeEvent<HTMLInputElement>): void {
    const archive = event.target.files?.item(0);
    if (archive) {
      zipMutation.mutate(archive);
    }
  }

  function handleFolderChange(event: ChangeEvent<HTMLInputElement>): void {
    setFolderFiles(event.target.files);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 border-b border-cyan-400/10 pb-6 md:flex-row md:items-end">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="cyan">Ingestion</Badge>
            <Badge variant="neutral">RBAC protected</Badge>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-wide text-white">
            Repositories
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Add a GitHub repo, archive, folder, or a public deployed URL. Live sites are crawled
            (homepage plus a few same-origin pages) and analyzed like a snapshot — not a full source dump.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          {repositoriesQuery.isFetching ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={16} />
          ) : null}
          {repositoriesQuery.data?.items.length ?? 0} repositories
        </div>
      </section>

      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          <ShieldAlert aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <form
          className="rounded-xl border border-cyan-400/15 bg-white/[0.03] p-4 backdrop-blur-sm"
          onSubmit={(event) => {
            event.preventDefault();
            githubMutation.mutate();
          }}
        >
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
            <GitBranch aria-hidden="true" className="text-cyan-300" size={17} />
            GitHub URL
          </div>
          <div className="flex gap-2">
            <Input
              onChange={(event) => { setGithubUrl(event.target.value); }}
              placeholder="https://github.com/org/repo"
              type="url"
              value={githubUrl}
            />
            <Button
              aria-label="Add GitHub repository"
              disabled={!githubUrl || githubMutation.isPending}
              size="icon"
            >
              <Plus aria-hidden="true" size={18} />
            </Button>
          </div>
        </form>

        <form
          className="rounded-xl border border-cyan-400/15 bg-white/[0.03] p-4 backdrop-blur-sm"
          onSubmit={(event) => {
            event.preventDefault();
            websiteMutation.mutate();
          }}
        >
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
            <Globe aria-hidden="true" className="text-violet-300" size={17} />
            Deployed site URL
          </div>
          <div className="flex gap-2">
            <Input
              onChange={(event) => { setWebsiteUrl(event.target.value); }}
              placeholder="https://www.example.com"
              type="url"
              value={websiteUrl}
            />
            <Button
              aria-label="Analyze deployed website"
              disabled={!websiteUrl || websiteMutation.isPending}
              size="icon"
            >
              <Plus aria-hidden="true" size={18} />
            </Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Public HTTPS pages only. Private/local addresses are blocked.
          </p>
        </form>

        <div className="rounded-xl border border-cyan-400/15 bg-white/[0.03] p-4 backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
            <FileArchive aria-hidden="true" className="text-amber-300" size={17} />
            ZIP Upload
          </div>
          <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300 transition hover:border-cyan-400 hover:text-white">
            <FileArchive aria-hidden="true" size={16} />
            Select archive
            <input accept=".zip" className="sr-only" onChange={handleZipChange} type="file" />
          </label>
        </div>

        <div className="rounded-xl border border-cyan-400/15 bg-white/[0.03] p-4 backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
            <FolderUp aria-hidden="true" className="text-emerald-300" size={17} />
            Folder Upload
          </div>
          <div className="flex gap-2">
            <label className="flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300 transition hover:border-cyan-400 hover:text-white">
              <FolderUp aria-hidden="true" size={16} />
              <span className="truncate">
                {folderFiles ? `${folderFiles.length} files` : "Choose folder"}
              </span>
              <input
                className="sr-only"
                multiple
                onChange={handleFolderChange}
                type="file"
                {...{ webkitdirectory: "" }}
              />
            </label>
            <Button
              aria-label="Submit folder upload"
              disabled={!folderFiles || folderMutation.isPending}
              onClick={() => { folderMutation.mutate(); }}
              size="icon"
              type="button"
            >
              <Plus aria-hidden="true" size={18} />
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {repositoriesQuery.data?.items.map((repository, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 16 }}
            key={repository.id}
            transition={{ delay: index * 0.05 }}
          >
            <RepositoryRadarCard
              branch={repository.defaultBranch}
              createdAt={repository.createdAt}
              id={repository.id}
              name={repository.name}
            />
          </motion.div>
        ))}
        {repositoriesQuery.data?.items.length === 0 ? (
          <div className="col-span-full px-4 py-16 text-center text-sm text-slate-500">
            No repositories have been added.
          </div>
        ) : null}
      </section>
    </div>
  );
}


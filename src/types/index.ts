export type ProjectWithImages = {
  id: string;
  title: string;
  titleTr: string | null;
  titleEn: string | null;
  slug: string;
  description: string | null;
  descriptionTr: string | null;
  descriptionEn: string | null;
  location: string | null;
  year: number | null;
  category: string | null;
  categories: {
    category: {
      id: string;
      name: string;
      nameTr: string | null;
      nameEn: string | null;
      slug: string;
    };
  }[];
  pdfUrl: string | null;
  featured: boolean;
  published: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  images: {
    id: string;
    url: string;
    originalUrl: string | null;
    webUrl: string | null;
    thumbnailUrl: string | null;
    fileSize: number | null;
    width: number | null;
    height: number | null;
    mimeType: string | null;
    alt: string | null;
    sortOrder: number;
  }[];
};

export type DashboardStats = {
  totalProjects: number;
  publishedProjects: number;
  draftProjects: number;
  totalImages: number;
  featuredProjects: number;
};

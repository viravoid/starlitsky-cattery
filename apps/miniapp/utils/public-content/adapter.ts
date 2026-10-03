import type {
  CatData,
  CatListData,
  CommunityCommentData,
  CommunityPostCategory,
  CommunityPostData,
  CommunityPostListData,
  CommunityPostOptionsData,
  CompleteMediaUploadRequest,
  CreateCommunityPostRequest,
  CreateMyCatRequest,
  DeleteCommunityPostMediaData,
  FixedPageData,
  ImageUploadData,
  MediaAssetData,
  MyCatData,
  MyCatListData,
  SelectionApplicationData,
  SubmitSelectionApplicationRequest,
  ToggleCommunityPostLikeData,
  UpdateCommunityPostRequest,
  UpdateMyCatRequest,
} from "@starlitsky/shared";

type MaybePromise<T> = T | Promise<T>;

export interface PublicContentAdapter {
  completeCommunityPostImageUpload?(
    postId: string,
    mediaId: string,
    data?: CompleteMediaUploadRequest,
  ): MaybePromise<MediaAssetData>;
  createCommunityComment?(id: string, content: string): MaybePromise<CommunityCommentData>;
  createCommunityPost?(data: CreateCommunityPostRequest): MaybePromise<CommunityPostData>;
  createMyCat?(data: CreateMyCatRequest): MaybePromise<MyCatData>;
  deleteCommunityComment?(postId: string, commentId: string): MaybePromise<CommunityCommentData>;
  deleteCommunityPost?(id: string): MaybePromise<CommunityPostData>;
  deleteCommunityPostImage?(postId: string, mediaId: string): MaybePromise<DeleteCommunityPostMediaData>;
  deleteMyCat?(id: string): MaybePromise<MyCatData>;
  getCommunityPost?(id: string): MaybePromise<CommunityPostData>;
  getCommunityPostOptions?(): MaybePromise<CommunityPostOptionsData>;
  getFixedPage?(slug: string): MaybePromise<FixedPageData>;
  getMyCat?(id: string): MaybePromise<MyCatData>;
  getPublicCat?(id: string): MaybePromise<CatData>;
  listCommunityPosts?(params?: {
    catId?: string;
    category?: CommunityPostCategory | string;
    litterId?: string;
    pageSize?: number;
    q?: string;
  }): MaybePromise<CommunityPostListData>;
  listMyCats?(params?: { pageSize?: number }): MaybePromise<MyCatListData>;
  listMyCommunityPosts?(params?: { pageSize?: number }): MaybePromise<CommunityPostListData>;
  listPublicCats?(params: {
    lifecycleStatus?: string;
    pageSize?: number;
    q?: string;
  }): MaybePromise<CatListData>;
  requestCommunityPostImageUpload?(
    postId: string,
    data: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      title?: string | null;
      altText?: string | null;
      width?: number | null;
      height?: number | null;
      usage?: string;
      sortOrder?: number;
    },
  ): MaybePromise<ImageUploadData>;
  submitSelectionApplication?(
    data: SubmitSelectionApplicationRequest,
  ): MaybePromise<SelectionApplicationData>;
  toggleCommunityPostLike?(id: string): MaybePromise<ToggleCommunityPostLikeData>;
  updateCommunityPost?(
    id: string,
    data: UpdateCommunityPostRequest,
  ): MaybePromise<CommunityPostData>;
  updateMyCat?(id: string, data: UpdateMyCatRequest): MaybePromise<MyCatData>;
}

let activeAdapter: PublicContentAdapter | null = null;

export function setPublicContentAdapter(adapter: PublicContentAdapter | null) {
  activeAdapter = adapter;
}

export function getPublicContentAdapter() {
  return activeAdapter;
}

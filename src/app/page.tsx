type PageProps = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Page({ searchParams }: PageProps) {
    const params = await searchParams;

    return <div>Page Content</div>;
}

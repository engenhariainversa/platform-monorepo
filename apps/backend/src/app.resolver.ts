import {
  Resolver,
  Query,
  Mutation,
  Args,
  Field,
  ObjectType,
  ID,
} from "@nestjs/graphql";
import { prisma } from "@repo/database";

@ObjectType()
class CmsPageType {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  title!: string;

  @Field()
  content!: string;
}

@Resolver()
export class AppResolver {
  @Query(() => String)
  hello(): string {
    return "Welcome to Engenhariainversa NestJS CMS Backend!";
  }

  @Query(() => [CmsPageType])
  async pages(): Promise<CmsPageType[]> {
    return prisma.cmsPage.findMany();
  }

  @Mutation(() => CmsPageType)
  async createPage(
    @Args("slug") slug: string,
    @Args("title") title: string,
    @Args("content") content: string,
  ): Promise<CmsPageType> {
    return prisma.cmsPage.create({
      data: { slug, title, content },
    });
  }
}

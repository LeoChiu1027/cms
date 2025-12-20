import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from '@mikro-orm/core';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TagsService } from './tags.service';
import { Tag } from './entities/tag.entity';

describe('TagsService', () => {
  let service: TagsService;
  let em: jest.Mocked<EntityManager>;

  const mockTag = {
    id: 'tag-1',
    name: 'Technology',
    slug: 'technology',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockEm = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      persist: jest.fn(),
      persistAndFlush: jest.fn(),
      flush: jest.fn(),
      removeAndFlush: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        {
          provide: EntityManager,
          useValue: mockEm,
        },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
    em = module.get(EntityManager);
  });

  // =========================================
  // create
  // =========================================

  describe('create', () => {
    it('should create a tag with valid data', async () => {
      // Arrange
      const dto = { name: 'Technology', slug: 'technology' };
      em.findOne.mockResolvedValue(null);
      em.create.mockReturnValue(mockTag);

      // Act
      const result = await service.create(dto);

      // Assert
      expect(em.findOne).toHaveBeenCalledWith(Tag, { slug: dto.slug });
      expect(em.findOne).toHaveBeenCalledWith(Tag, { name: dto.name });
      expect(em.create).toHaveBeenCalledWith(Tag, {
        name: dto.name,
        slug: dto.slug,
      });
      expect(em.persistAndFlush).toHaveBeenCalledWith(mockTag);
      expect(result).toEqual(mockTag);
    });

    it('should throw ConflictException when slug already exists', async () => {
      // Arrange
      const dto = { name: 'New Tag', slug: 'technology' };
      em.findOne.mockResolvedValue(mockTag); // slug check returns existing

      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow(
        'Tag with this slug already exists',
      );
    });

    it('should throw ConflictException when name already exists', async () => {
      // Arrange
      const dto = { name: 'Technology', slug: 'new-slug' };
      em.findOne
        .mockResolvedValueOnce(null) // slug check passes
        .mockResolvedValueOnce(mockTag); // name check returns existing

      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // =========================================
  // findAll
  // =========================================

  describe('findAll', () => {
    it('should return paginated tags without search', async () => {
      // Arrange
      const tags = [mockTag];
      em.findAndCount.mockResolvedValue([tags, 1]);

      // Act
      const result = await service.findAll(1, 20);

      // Assert
      expect(em.findAndCount).toHaveBeenCalledWith(
        Tag,
        {},
        {
          limit: 20,
          offset: 0,
          orderBy: { createdAt: 'DESC' },
        },
      );
      expect(result).toEqual({ data: tags, total: 1 });
    });

    it('should return paginated tags with search filter', async () => {
      // Arrange
      const tags = [mockTag];
      em.findAndCount.mockResolvedValue([tags, 1]);

      // Act
      const result = await service.findAll(1, 20, 'tech');

      // Assert
      expect(em.findAndCount).toHaveBeenCalledWith(
        Tag,
        { name: { $ilike: '%tech%' } },
        {
          limit: 20,
          offset: 0,
          orderBy: { createdAt: 'DESC' },
        },
      );
      expect(result).toEqual({ data: tags, total: 1 });
    });

    it('should calculate correct offset for page 2', async () => {
      // Arrange
      em.findAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.findAll(2, 10);

      // Assert
      expect(em.findAndCount).toHaveBeenCalledWith(
        Tag,
        {},
        {
          limit: 10,
          offset: 10, // (page - 1) * limit = (2 - 1) * 10 = 10
          orderBy: { createdAt: 'DESC' },
        },
      );
    });
  });

  // =========================================
  // findOne
  // =========================================

  describe('findOne', () => {
    it('should return tag when found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(mockTag);

      // Act
      const result = await service.findOne('tag-1');

      // Assert
      expect(em.findOne).toHaveBeenCalledWith(Tag, { id: 'tag-1' });
      expect(result).toEqual(mockTag);
    });

    it('should throw NotFoundException when tag not found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Tag not found',
      );
    });
  });

  // =========================================
  // remove
  // =========================================

  describe('remove', () => {
    it('should remove tag when found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(mockTag);

      // Act
      await service.remove('tag-1');

      // Assert
      expect(em.findOne).toHaveBeenCalledWith(Tag, { id: 'tag-1' });
      expect(em.removeAndFlush).toHaveBeenCalledWith(mockTag);
    });

    it('should throw NotFoundException when tag not found', async () => {
      // Arrange
      em.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove('nonexistent')).rejects.toThrow(
        'Tag not found',
      );
    });
  });
});

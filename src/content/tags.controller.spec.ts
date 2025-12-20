import { Test, TestingModule } from '@nestjs/testing';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

describe('TagsController', () => {
  let controller: TagsController;
  let service: jest.Mocked<TagsService>;

  const mockTag = {
    id: 'tag-1',
    name: 'Technology',
    slug: 'technology',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TagsController],
      providers: [
        {
          provide: TagsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<TagsController>(TagsController);
    service = module.get(TagsService);
  });

  // =========================================
  // create
  // =========================================

  describe('create', () => {
    it('should call service.create and return the tag', async () => {
      // Arrange
      const dto = { name: 'Technology', slug: 'technology' };
      service.create.mockResolvedValue(mockTag as any);

      // Act
      const result = await controller.create(dto);

      // Assert
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTag);
    });
  });

  // =========================================
  // findAll
  // =========================================

  describe('findAll', () => {
    it('should call service.findAll and return paginated response', async () => {
      // Arrange
      service.findAll.mockResolvedValue({ data: [mockTag as any], total: 1 });

      // Act
      const result = await controller.findAll('1', '20');

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(1, 20, undefined);
      expect(result).toEqual({
        data: [mockTag],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it('should handle search parameter', async () => {
      // Arrange
      service.findAll.mockResolvedValue({ data: [mockTag as any], total: 1 });

      // Act
      await controller.findAll('1', '20', 'tech');

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(1, 20, 'tech');
    });

    it('should enforce min/max limits for page and limit', async () => {
      // Arrange
      service.findAll.mockResolvedValue({ data: [], total: 0 });

      // Act
      await controller.findAll('0', '200');

      // Assert - page should be min 1, limit should be max 100
      expect(service.findAll).toHaveBeenCalledWith(1, 100, undefined);
    });

    it('should calculate totalPages correctly', async () => {
      // Arrange
      service.findAll.mockResolvedValue({ data: [], total: 50 });

      // Act
      const result = await controller.findAll('1', '20');

      // Assert
      expect(result.meta.totalPages).toBe(3); // 50 / 20 = 2.5, ceil = 3
    });
  });

  // =========================================
  // findOne
  // =========================================

  describe('findOne', () => {
    it('should call service.findOne and return the tag', async () => {
      // Arrange
      service.findOne.mockResolvedValue(mockTag as any);

      // Act
      const result = await controller.findOne('tag-1');

      // Assert
      expect(service.findOne).toHaveBeenCalledWith('tag-1');
      expect(result).toEqual(mockTag);
    });
  });

  // =========================================
  // remove
  // =========================================

  describe('remove', () => {
    it('should call service.remove', async () => {
      // Arrange
      service.remove.mockResolvedValue(undefined);

      // Act
      await controller.remove('tag-1');

      // Assert
      expect(service.remove).toHaveBeenCalledWith('tag-1');
    });
  });
});
